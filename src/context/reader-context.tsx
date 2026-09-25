// Holds the reader for the whole app, so the input screen and the reader screen share it.
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, use, useEffect, useState, type ReactNode } from 'react';
import { AccessibilityInfo, AppState } from 'react-native';

import { SAMPLE_TEXT } from '@/constants/sample-text';
import { useReader, type Reader, type ReaderActions, type SavedReader } from '@/hooks/use-reader';

const STORE_KEY = 'roadrunner.reader';
// The text is stored on its own, so saving the position doesn't rewrite a whole book.
const TEXT_KEY = 'roadrunner.reader.text';
const ReaderContext = createContext<Reader | null>(null);
const ActionsContext = createContext<ReaderActions | null>(null);

// Full reader state; components using it re-render on every word.
export const useReaderContext = () => use(ReaderContext)!;
// Only the actions, which stay the same between words: use this where state isn't needed.
export const useReaderActions = () => use(ActionsContext)!;

// The text last written, so it's only written again when it changes. Starts as a value no
// text can be, so the first save always syncs it (and moves it out of an older combined entry).
let savedText: string | undefined | null = null;

function save({ text, ...rest }: SavedReader) {
  const position = JSON.stringify(rest);
  const write =
    text === savedText
      ? AsyncStorage.setItem(STORE_KEY, position)
      : text === undefined
        ? AsyncStorage.removeItem(TEXT_KEY).then(() => AsyncStorage.setItem(STORE_KEY, position))
        : AsyncStorage.multiSet([[STORE_KEY, position], [TEXT_KEY, text]]);
  savedText = text;
  write.catch(() => {
    savedText = null;
    /* storage unavailable or full */
  });
}

async function load(): Promise<SavedReader> {
  const [[, raw], [, text]] = await AsyncStorage.multiGet([STORE_KEY, TEXT_KEY]);
  const saved: SavedReader = JSON.parse(raw || 'null') || {};
  // Older saves kept the text inside the main entry.
  return text !== null ? { ...saved, text } : saved;
}

type Boot = { initial: SavedReader; reduceMotion: boolean };

function Provider({ initial, reduceMotion, children }: Boot & { children: ReactNode }) {
  const reader = useReader({ sampleText: SAMPLE_TEXT, initial, onSave: save, countdownMs: reduceMotion ? 400 : 1000 });

  // Pause when the app goes to the background.
  const { pause } = reader;
  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => state !== 'active' && pause());
    return () => sub.remove();
  }, [pause]);

  return (
    <ActionsContext value={reader.actions}>
      <ReaderContext value={reader}>{children}</ReaderContext>
    </ActionsContext>
  );
}

// Loads the saved position and speed before the reader starts. Renders nothing until then.
export function ReaderProvider({ children }: { children: ReactNode }) {
  const [boot, setBoot] = useState<Boot | null>(null);
  useEffect(() => {
    Promise.all([
      load().catch((): SavedReader => ({})),
      AccessibilityInfo.isReduceMotionEnabled().catch(() => false),
    ]).then(([initial, reduceMotion]) => setBoot({ initial, reduceMotion }));
  }, []);
  if (!boot) return null;
  return <Provider {...boot}>{children}</Provider>;
}
