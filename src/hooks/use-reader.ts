// Reader state and playback. Platform concerns (storage, app visibility) are handled by the caller.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import {
  WPM_DEFAULT,
  buildWeights,
  buildWeightsFrom,
  clampWpm,
  formatDuration,
  intervalFor,
  secondsLeft,
  tokenize,
} from '@/lib/rsvp';

// After a stall longer than this (app in background, long GC), timing restarts from now
// instead of racing through words to catch up.
const MAX_CATCH_UP_MS = 250;

/** What the reader starts from: the speed, and the library item open last (with its text). */
export type InitialReader = { wpm?: number; id?: string; text?: string; label?: string; index?: number };
/** What is persisted: the speed, and which library item is open and where. */
export type SavedReader = { wpm: number; id?: string; index?: number };

type Source = { words: string[]; text: string; label: string; isSample: boolean; id?: string };

type Options = {
  /** Shown when nothing else is loaded. */
  sampleText: string;
  /** Saved state to resume from. */
  initial?: InitialReader;
  /** Receives state to persist (debounced). */
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
      id: text ? initial.id : undefined,
    };
  });
  const [index, setIndex] = useState(() => {
    const i = initial.index || 0;
    return !source.isSample && i < source.words.length ? i : 0;
  });
  const [wpm, setWpmState] = useState(() => clampWpm(initial.wpm || WPM_DEFAULT));
  const [playing, setPlaying] = useState(false);
  const [countdown, setCountdown] = useState<number | null>(null);
  // Playback suspended while the stage is held down; `playing` stays true so the stage stays up.
  const [held, setHeld] = useState(false);
  const [status, setStatus] = useState('');

  const { words } = source;
  const weights = useMemo(() => buildWeights(words), [words]);
  const weightsFrom = useMemo(() => buildWeightsFrom(weights), [weights]);
  // When word `index` was due to appear, so timing follows the schedule rather than render speed,
  // and the frame rounding carried over from the word before it (see intervalFor).
  const scheduled = useRef<{ index: number; at: number; carry: number } | null>(null);
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
    if (!playing || held || index >= words.length) return;
    // Time each word from when it was due, not from when this render finished, so render time
    // doesn't add up word after word. Speed is read from a ref so dragging the slider doesn't
    // restart the current word.
    const now = performance.now();
    const due = scheduled.current;
    const onSchedule = due && due.index === index && now - due.at < MAX_CATCH_UP_MS;
    let { seconds, carry } = intervalFor(weights[index], wpmRef.current, onSchedule ? due.carry : 0);
    let end = (onSchedule ? due.at : now) + seconds * 1000;
    // Already over (a short stall): start the word now. Otherwise the next word would start in the
    // past too, and words would flash by unseen until the schedule caught up.
    if (end <= now) {
      ({ seconds, carry } = intervalFor(weights[index], wpmRef.current));
      end = now + seconds * 1000;
    }
    const t = setTimeout(() => {
      scheduled.current = { index: index + 1, at: end, carry };
      setIndex(index + 1);
      if (index + 1 >= words.length) setPlaying(false);
    }, Math.max(0, end - now));
    return () => clearTimeout(t);
  }, [playing, held, index, words, weights]);

  // ── Actions ──
  const play = useCallback(() => {
    setIndex((i) => (i >= words.length ? 0 : i));
    setStatus('');
    setHeld(false);
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
  const saveBucket = playing ? Math.floor(index / 100) : index;
  useEffect(() => {
    const t = setTimeout(() => {
      const data: SavedReader = source.id ? { wpm, id: source.id, index } : { wpm };
      onSaveRef.current?.(data);
    }, 800);
    return () => clearTimeout(t);
  }, [wpm, source, playing, saveBucket]); // eslint-disable-line react-hooks/exhaustive-deps

  const pause = useCallback(() => {
    if (playingRef.current) setStatus('Paused');
    setPlaying(false);
    setHeld(false);
  }, []);

  // Hold pauses only while pressed; release picks up again at the word it stopped on. A stall
  // longer than MAX_CATCH_UP_MS restarts timing, so the held word gets its full interval again.
  const hold = useCallback(() => {
    if (playingRef.current) setHeld(true);
  }, []);
  const release = useCallback(() => setHeld(false), []);

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

  // Returns false when the text has no words. `id` is the library item it came from, whose
  // position is saved as it's read; `index` is where to resume.
  const loadText = useCallback((text: string, label: string, { sample = false, id = undefined as string | undefined, index = 0 } = {}) => {
    const w = tokenize(text);
    if (!w.length) return false;
    setPlaying(false);
    setHeld(false);
    setCountdown(null);
    setSource({ words: w, text: text.trim(), label, isSample: sample, id });
    setIndex(index > 0 && index < w.length ? index : 0);
    setStatus('');
    return true;
  }, []);

  // The library item that's loaded, read through a ref so `actions` stays stable.
  const sourceRef = useRef(source);
  useEffect(() => {
    sourceRef.current = source;
  });
  const loadedId = useCallback(() => sourceRef.current.id, []);

  // Stable across words, for screens that only act on the reader (import, insert text).
  const actions = useMemo(
    () => ({ play, pause, hold, release, toggle, seekTo, restart, setWpm, loadText, loadedId, startCountdown, cancelCountdown }),
    [play, pause, hold, release, toggle, seekTo, restart, setWpm, loadText, loadedId, startCountdown, cancelCountdown]
  );

  const done = index >= words.length;
  const atStart = index === 0;
  const shownStatus = held ? 'Paused' : status;

  // Changes every word, so only the few components that show the word or progress read it.
  const position = useMemo(
    () => ({
      index,
      currentWord: words[Math.min(index, words.length - 1)] || '',
      progress: words.length ? index / words.length : 0,
      timeLeft: done ? 'Done' : formatDuration(secondsLeft(weightsFrom, index, wpm)) + ' left',
    }),
    [index, words, weightsFrom, wpm, done]
  );

  // Everything else, which only changes when playback starts or stops, or the text or speed changes.
  const state = useMemo(
    () => ({ words, source, wpm, playing, held, countdown, status: shownStatus, atStart, done }),
    [words, source, wpm, playing, held, countdown, shownStatus, atStart, done]
  );

  return { state, position, actions };
}

export type Reader = ReturnType<typeof useReader>;
export type ReaderState = Reader['state'];
export type ReaderPosition = Reader['position'];
export type ReaderActions = Reader['actions'];
