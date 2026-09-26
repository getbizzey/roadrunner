// Holds the reader for the whole app, so the input screen and the reader screen share it.
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, use, useEffect, useState, type ReactNode } from 'react';
import { AccessibilityInfo, AppState } from 'react-native';

import { SAMPLE_TEXT } from '@/constants/sample-text';
import { useReader, type InitialReader, type Reader, type ReaderActions, type SavedReader } from '@/hooks/use-reader';
import { getLibraryItem, loadLibrary, readLibraryText, updateProgress } from '@/lib/library';

const STORE_KEY = 'roadrunner.reader';
const ReaderContext = createContext<Reader | null>(null);
const ActionsContext = createContext<ReaderActions | null>(null);

// Full reader state; components using it re-render on every word.
export const useReaderContext = () => use(ReaderContext)!;
// Only the actions, which stay the same between words: use this where state isn't needed.
export const useReaderActions = () => use(ActionsContext)!;

// The speed and open item are saved here; the position goes to the item in the library.
function save({ wpm, id, index }: SavedReader) {
  AsyncStorage.setItem(STORE_KEY, JSON.stringify({ wpm, id })).catch(() => {
    /* storage unavailable or full */
  });
  if (id && index !== undefined) updateProgress(id, index);
}

type Stored = { wpm?: number; id?: string };

// Reopens the item that was being read, so the reader screen picks up where it was left.
async function load(): Promise<InitialReader> {
  await loadLibrary();
  const stored: Stored = JSON.parse((await AsyncStorage.getItem(STORE_KEY)) || 'null') || {};

  const item = stored.id ? getLibraryItem(stored.id) : undefined;
  const itemText = item && (await readLibraryText(item.id));
  if (!item || !itemText) return { wpm: stored.wpm };
  return { wpm: stored.wpm, id: item.id, text: itemText, label: item.title, index: item.index };
}

type Boot = { initial: InitialReader; reduceMotion: boolean };

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

// Loads the library, the saved speed and the open item before the reader starts. Renders nothing until then.
export function ReaderProvider({ children }: { children: ReactNode }) {
  const [boot, setBoot] = useState<Boot | null>(null);
  useEffect(() => {
    Promise.all([
      load().catch((): InitialReader => ({})),
      AccessibilityInfo.isReduceMotionEnabled().catch(() => false),
    ]).then(([initial, reduceMotion]) => setBoot({ initial, reduceMotion }));
  }, []);
  if (!boot) return null;
  return <Provider {...boot}>{children}</Provider>;
}
