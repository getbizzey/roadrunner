// Pick a document or book and turn it into plain text. Nothing leaves the device
// (PDF parsing loads pdf.js from a CDN, but the file itself is never uploaded).
import * as DocumentPicker from 'expo-document-picker';
import { File } from 'expo-file-system';
import { Platform } from 'react-native';

import { readEpub, type EpubCover } from '@/lib/epub';

const MAX_CHARS = 2_000_000;

export type ImportKind = 'file' | 'book';
export type ExtractKind = 'pdf' | 'html' | 'book';
type OnProgress = (message: string) => void;

// Implemented by the TextExtractor component (a hidden WebView natively, the page itself on web).
export type Extractor = {
  extract: (kind: ExtractKind, data: string, onProgress?: OnProgress) => Promise<string>;
};

const PICKER_TYPES: Record<ImportKind, string[]> = {
  file: ['text/*', 'application/pdf'],
  book: ['application/epub+zip'],
};

async function readText(asset: DocumentPicker.DocumentPickerAsset): Promise<string> {
  // On web the picker hands back a browser File instead of a file:// URI.
  if (Platform.OS === 'web') return asset.file!.text();
  return new File(asset.uri).text();
}

async function readBytes(asset: DocumentPicker.DocumentPickerAsset): Promise<Uint8Array> {
  if (Platform.OS === 'web') return new Uint8Array(await asset.file!.arrayBuffer());
  return new File(asset.uri).bytes();
}

function bytesToBase64(bytes: Uint8Array) {
  let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(bin);
}

const stripExtension = (name: string) => name.replace(/\.[^.]+$/, '');

/**
 * Opens the system file picker for a document ('file') or an EPUB ('book').
 * Resolves to { title, text, cover }, or null when cancelled.
 */
export async function importDocument(
  kind: ImportKind,
  extractor: Extractor,
  onProgress?: OnProgress
): Promise<{ title: string; text: string; cover: EpubCover | null } | null> {
  const result = await DocumentPicker.getDocumentAsync({ type: PICKER_TYPES[kind], copyToCacheDirectory: true });
  if (result.canceled || !result.assets?.length) return null;
  const asset = result.assets[0];
  const name = asset.name || 'File';
  const ext = (name.split('.').pop() || '').toLowerCase();
  const mime = asset.mimeType || '';

  let title = stripExtension(name);
  let text: string;
  let cover: EpubCover | null = null;
  if (ext === 'epub' || mime === 'application/epub+zip') {
    onProgress?.('Opening book…');
    const book = readEpub(await readBytes(asset));
    if (book.title) title = book.title;
    cover = book.cover;
    text = await extractor.extract('book', JSON.stringify(book.chapters));
  } else if (ext === 'pdf' || mime === 'application/pdf') {
    onProgress?.('Reading PDF…');
    text = await extractor.extract('pdf', bytesToBase64(await readBytes(asset)), onProgress);
  } else if (ext === 'html' || ext === 'htm' || mime === 'text/html') {
    text = await extractor.extract('html', await readText(asset));
  } else {
    text = await readText(asset);
  }
  return { title, cover, text: text.length > MAX_CHARS ? text.slice(0, MAX_CHARS) : text };
}
