// Holds the reader for the whole app, so the input screen and the reader screen share it.
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, use, useEffect, useState, type ReactNode } from 'react';
import { AccessibilityInfo, AppState } from 'react-native';

import { SAMPLE_TEXT } from '@/constants/sample-text';
import {
  useReader,
  type InitialReader,
  type ReaderActions,
  type ReaderPosition,
  type ReaderState,
  type SavedReader,
} from '@/hooks/use-reader';
import { getLibraryItem, loadLibrary, readLibraryText, updateProgress } from '@/lib/library';

const STORE_KEY = 'roadrunner.reader';
const StateContext = createContext<ReaderState | null>(null);
const PositionContext = createContext<ReaderPosition | null>(null);
const ActionsContext = createContext<ReaderActions | null>(null);

// Reader state that stays the same between words (text, speed, playing, countdown).
export const useReaderState = () => use(StateContext)!;
// The current word and progress; components using it re-render on every word, so keep them small.
export const useReaderPosition = () => use(PositionContext)!;
// Only the actions, which never change: use this where state isn't needed.
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
  const { state, position, actions } = useReader({
    sampleText: SAMPLE_TEXT,
    initial,
    onSave: save,
    countdownMs: reduceMotion ? 400 : 1000,
  });

  // Pause when the app goes to the background.
  const { pause } = actions;
  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => state !== 'active' && pause());
    return () => sub.remove();
  }, [pause]);

  return (
    <ActionsContext value={actions}>
      <StateContext value={state}>
        <PositionContext value={position}>{children}</PositionContext>
      </StateContext>
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
