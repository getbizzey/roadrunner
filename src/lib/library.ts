// The reading library: every imported file, book and inserted text, with how far it has been read.
// The list lives in AsyncStorage; texts and covers are files in the document directory (on web,
// which has no file system, texts go to AsyncStorage too and covers aren't kept).
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Directory, File, Paths } from 'expo-file-system';
import { useSyncExternalStore } from 'react';
import { Platform } from 'react-native';

import type { EpubCover } from '@/lib/epub';
import type { ChapterMark } from '@/lib/files';
import { tokenize } from '@/lib/rsvp';

export type LibraryKind = 'file' | 'book' | 'text';

export type LibraryItem = {
  id: string;
  title: string;
  kind: LibraryKind;
  /** Total words. */
  words: number;
  /** Word to resume from. */
  index: number;
  addedAt: number;
  /** Last opened or read. */
  readAt: number;
  /** Cover image file name, inside the library folder. */
  cover?: string;
  /** Books only: where each chapter starts. */
  chapters?: ChapterMark[];
};

const LIST_KEY = 'roadrunner.library';
const WEB_TEXT_KEY = 'roadrunner.library.text.';
const isWeb = Platform.OS === 'web';

// Resolved on use: the document directory's path can change when iOS updates the app.
const folder = () => new Directory(Paths.document, 'library');
const textFile = (id: string) => new File(folder(), `${id}.txt`);

let items: LibraryItem[] = [];
const listeners = new Set<() => void>();

function persist() {
  AsyncStorage.setItem(LIST_KEY, JSON.stringify(items)).catch(() => {
    /* storage unavailable or full */
  });
}

function commit(next: LibraryItem[]) {
  items = next;
  listeners.forEach((l) => l());
  persist();
}

const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};

/** The library, most recently read first. */
export const useLibrary = () => useSyncExternalStore(subscribe, () => items);

export const getLibraryItem = (id: string) => items.find((i) => i.id === id);

/** Reads the saved list. Call once before anything else uses the library. */
export async function loadLibrary() {
  const raw = await AsyncStorage.getItem(LIST_KEY);
  items = JSON.parse(raw || '[]');
  listeners.forEach((l) => l());
}

export function coverUri(item: LibraryItem) {
  return item.cover && !isWeb ? new File(folder(), item.cover).uri : undefined;
}

type NewItem = {
  title: string;
  text: string;
  kind: LibraryKind;
  cover?: EpubCover | null;
  chapters?: ChapterMark[];
  index?: number;
};

/** Stores the text (and cover) and adds it to the top of the library. Null when the text has no words. */
export async function addToLibrary({ title, text, kind, cover, chapters, index = 0 }: NewItem): Promise<LibraryItem | null> {
  const words = tokenize(text).length;
  if (!words) return null;
  const id = Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  let coverName: string | undefined;

  if (isWeb) {
    await AsyncStorage.setItem(WEB_TEXT_KEY + id, text);
  } else {
    folder().create({ idempotent: true, intermediates: true });
    textFile(id).write(text);
    if (cover) {
      try {
        coverName = `${id}.${cover.ext}`;
        new File(folder(), coverName).write(cover.bytes);
      } catch {
        coverName = undefined; // a book without its cover is still worth keeping
      }
    }
  }

  const now = Date.now();
  const item: LibraryItem = {
    id,
    title,
    kind,
    words,
    index: Math.min(index, words - 1),
    addedAt: now,
    readAt: now,
    cover: coverName,
    chapters: chapters?.length ? chapters : undefined,
  };
  commit([item, ...items]);
  return item;
}

/** The item's full text, or null when it's gone. */
export async function readLibraryText(id: string): Promise<string | null> {
  try {
    if (isWeb) return await AsyncStorage.getItem(WEB_TEXT_KEY + id);
    const file = textFile(id);
    return file.exists ? await file.text() : null;
  } catch {
    return null;
  }
}

/** Remembers where reading stopped, and moves the item to the top. */
export function updateProgress(id: string, index: number) {
  const item = getLibraryItem(id);
  if (!item || item.index === index) return;
  touch(item, { index });
}

/** Moves the item to the top, as just read. */
export function markOpened(id: string) {
  const item = getLibraryItem(id);
  if (item) touch(item, {});
}

function touch(item: LibraryItem, changes: Partial<LibraryItem>) {
  commit([{ ...item, ...changes, readAt: Date.now() }, ...items.filter((i) => i !== item)]);
}

export function removeFromLibrary(id: string) {
  const item = getLibraryItem(id);
  if (!item) return;
  commit(items.filter((i) => i !== item));
  if (isWeb) {
    AsyncStorage.removeItem(WEB_TEXT_KEY + id).catch(() => {});
    return;
  }
  try {
    const text = textFile(id);
    if (text.exists) text.delete();
    const cover = item.cover && new File(folder(), item.cover);
    if (cover && cover.exists) cover.delete();
  } catch {
    /* already gone */
  }
}

/** A title for pasted text: its first line, shortened. */
export function titleFromText(text: string) {
  const line = text.trim().split('\n')[0].replace(/\s+/g, ' ').trim();
  return line.length > 80 ? line.slice(0, 80).replace(/\s+\S*$/, '') + '…' : line || 'Your text';
}
