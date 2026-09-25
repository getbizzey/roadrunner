// Reader state and playback. Platform concerns (storage, app visibility) are handled by the caller.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import {
  WPM_DEFAULT,
  buildWeightsFrom,
  clampWpm,
  formatDuration,
  intervalForWord,
  secondsLeft,
  tokenize,
} from '@/lib/rsvp';

// After a stall longer than this (app in background, long GC), timing restarts from now
// instead of racing through words to catch up.
const MAX_CATCH_UP_MS = 250;

export type SavedReader = { wpm?: number; text?: string; label?: string; index?: number };

type Source = { words: string[]; text: string; label: string; isSample: boolean };

type Options = {
  /** Shown when nothing else is loaded. */
  sampleText: string;
  /** Saved state to resume from. */
  initial?: SavedReader;
  /** Receives state to persist (debounced). `text` keeps the same string until the source changes. */
  onSave?: (data: SavedReader) => void;
  /** Length of one countdown beat. */
  countdownMs?: number;
};

export function useReader({ sampleText, initial = {}, onSave, countdownMs = 1000 }: Options) {
  const [source, setSource] = useState<Source>(() => {
    const text = initial.text?.trim() ? initial.text : null;
    return {
      words: tokenize(text ?? sampleText),
      text: (text ?? sampleText).trim(),
      label: text ? initial.label || 'Pasted' : 'Demo',
      isSample: !text,
    };
  });
  const [index, setIndex] = useState(() => {
    const i = initial.index || 0;
    return !source.isSample && i < source.words.length ? i : 0;
  });
  const [wpm, setWpmState] = useState(() => clampWpm(initial.wpm || WPM_DEFAULT));
  const [playing, setPlaying] = useState(false);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [status, setStatus] = useState('');

  const { words } = source;
  const weightsFrom = useMemo(() => buildWeightsFrom(words), [words]);
  // When word `index` was due to appear, so timing follows the schedule rather than render speed.
  const scheduled = useRef<{ index: number; at: number } | null>(null);
  const wpmRef = useRef(wpm);
  const playingRef = useRef(playing);
  const onSaveRef = useRef(onSave);
  useEffect(() => {
    wpmRef.current = wpm;
    playingRef.current = playing;
    onSaveRef.current = onSave;
  });

  // ── Playback loop: show the current word for its interval, then advance ──
  useEffect(() => {
    if (!playing || index >= words.length) return;
    // Time each word from when it was due, not from when this render finished, so render time
    // doesn't add up word after word. Speed is read from a ref so dragging the slider doesn't
    // restart the current word.
    const now = performance.now();
    const due = scheduled.current;
    const start = due && due.index === index && now - due.at < MAX_CATCH_UP_MS ? due.at : now;
    const end = start + intervalForWord(words[index], wpmRef.current) * 1000;
    const t = setTimeout(() => {
      scheduled.current = { index: index + 1, at: end };
      setIndex(index + 1);
      if (index + 1 >= words.length) setPlaying(false);
    }, Math.max(0, end - now));
    return () => clearTimeout(t);
  }, [playing, index, words]);

  // ── Actions ──
  const play = useCallback(() => {
    setIndex((i) => (i >= words.length ? 0 : i));
    setStatus('');
    setPlaying(true);
  }, [words.length]);

  // ── Countdown: three beats before the first word so it isn't missed ──
  useEffect(() => {
    if (countdown === null) return;
    const t = setTimeout(() => {
      if (countdown > 1) setCountdown(countdown - 1);
      else {
        setCountdown(null);
        play();
      }
    }, countdownMs);
    return () => clearTimeout(t);
  }, [countdown, countdownMs, play]);

  // ── Persistence: on pause, speed or source change, and every 100 words while playing ──
  // Built once per source: joining a long text on every save stalls playback.
  const savedText = useMemo(() => (source.isSample ? undefined : source.words.join(' ').slice(0, 500000)), [source]);
  const saveBucket = playing ? Math.floor(index / 100) : index;
  useEffect(() => {
    const t = setTimeout(() => {
      const data: SavedReader = source.isSample ? { wpm } : { wpm, label: source.label, index, text: savedText };
      onSaveRef.current?.(data);
    }, 800);
    return () => clearTimeout(t);
  }, [wpm, source, savedText, playing, saveBucket]); // eslint-disable-line react-hooks/exhaustive-deps

  const pause = useCallback(() => {
    if (playingRef.current) setStatus('Paused');
    setPlaying(false);
  }, []);

  const cancelCountdown = useCallback(() => setCountdown(null), []);

  const startCountdown = useCallback(() => {
    setPlaying(false);
    setStatus('');
    setCountdown(3);
  }, []);

  const toggle = useCallback(() => {
    if (countdown !== null) return;
    if (playingRef.current) pause();
    else play();
  }, [countdown, pause, play]);

  const seekTo = useCallback(
    (i: number) => {
      if (!Number.isFinite(i)) return;
      setIndex(Math.max(0, Math.min(words.length - 1, Math.floor(i))));
      if (!playingRef.current) setStatus('');
    },
    [words.length]
  );

  // Back to the first word, keeping whatever state it was in.
  const restart = useCallback(() => {
    setIndex(0);
    if (!playingRef.current) setStatus('Paused');
  }, []);

  const setWpm = useCallback((v: number) => setWpmState(clampWpm(v)), []);

  // Returns false when the text has no words.
  const loadText = useCallback((text: string, label: string, { sample = false } = {}) => {
    const w = tokenize(text);
    if (!w.length) return false;
    setPlaying(false);
    setCountdown(null);
    setSource({ words: w, text: text.trim(), label, isSample: sample });
    setIndex(0);
    setStatus('');
    return true;
  }, []);

  // Stable across words, for screens that only act on the reader (import, insert text).
  const actions = useMemo(
    () => ({ play, pause, toggle, seekTo, restart, setWpm, loadText, startCountdown, cancelCountdown }),
    [play, pause, toggle, seekTo, restart, setWpm, loadText, startCountdown, cancelCountdown]
  );

  const done = index >= words.length;
  return {
    words,
    source,
    index,
    currentWord: words[Math.min(index, words.length - 1)] || '',
    progress: words.length ? index / words.length : 0,
    timeLeft: done ? 'Done' : formatDuration(secondsLeft(weightsFrom, index, wpm)) + ' left',
    wpm,
    playing,
    countdown,
    status,
    ...actions,
    actions,
  };
}

export type Reader = ReturnType<typeof useReader>;
export type ReaderActions = Reader['actions'];
