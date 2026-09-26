// Pick or download a document or book and turn it into plain text. Nothing leaves the device
// (PDF parsing loads pdf.js from a CDN, but the file itself is never uploaded; downloads
// are fetched straight from their address).
import { fetch } from 'expo/fetch';
import * as DocumentPicker from 'expo-document-picker';
import { File } from 'expo-file-system';
import { strFromU8 } from 'fflate';
import { Platform } from 'react-native';

import { readEpub, type EpubChapter, type EpubCover } from '@/lib/epub';
import { tokenize } from '@/lib/rsvp';

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

// Latin-1 and its superset Windows-1252 map each byte to one character (close enough for the
// few 1252 punctuation marks in 0x80–0x9f to read fine).
const latin1 = (bytes: Uint8Array) => {
  let out = '';
  for (let i = 0; i < bytes.length; i += 0x8000) out += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return out;
};

const bytesToBase64 = (bytes: Uint8Array) => btoa(latin1(bytes));

/** Where a chapter starts, as a word index into the text. */
export type ChapterMark = { title: string; index: number };

// Joins the chapters' texts and notes the word each named chapter starts at. Files the table of
// contents skips (a chapter split in two, say) belong to the chapter before them.
function joinChapters(chapters: EpubChapter[], texts: string[]) {
  const parts: string[] = [];
  const marks: ChapterMark[] = [];
  let words = 0;
  chapters.forEach(({ title }, i) => {
    const text = texts[i] || '';
    if (title) {
      // A chapter with no text of its own (a part title page that's an image) gives way to the next.
      if (marks.at(-1)?.index === words) marks.pop();
      marks.push({ title, index: words });
    }
    if (!text) return;
    parts.push(text);
    words += tokenize(text).length;
  });
  return { text: parts.join('\n\n'), chapters: marks.filter((m) => m.index < words) };
}

const stripExtension = (name: string) => name.replace(/\.[^.]+$/, '');

export type ImportedDocument = {
  title: string;
  text: string;
  cover: EpubCover | null;
  chapters?: ChapterMark[];
  /** 'book' for EPUBs, 'file' for everything else. */
  kind: ImportKind;
};

// A file to import, however it arrived: picked from the device or downloaded.
type Source = { name: string; mime: string; bytes: () => Promise<Uint8Array>; text: () => Promise<string> };
type FileType = 'epub' | 'pdf' | 'html' | 'text';

const startsWith = (b: Uint8Array, sig: number[]) => sig.every((v, i) => b[i] === v);

// Books and PDFs are known by their first bytes alone: a server's content type and a URL's
// extension are often wrong (a ".epub" link can be a "your download has started" page). Other
// files go by mime type, extension, then content. Null when it can't be read, like an image.
function detectType(name: string, mime: string, head: Uint8Array): FileType | null {
  if (startsWith(head, [0x25, 0x50, 0x44, 0x46])) return 'pdf'; // %PDF
  if (startsWith(head, [0x50, 0x4b, 0x03, 0x04])) return 'epub'; // a zip; readEpub rejects any that aren't books
  const ext = (name.split('.').pop() || '').toLowerCase();
  const start = strFromU8(head.subarray(0, 512)).replace(/^\uFEFF?\s*(<\?xml[^>]*>\s*)?/i, '').toLowerCase();
  if (ext === 'html' || ext === 'htm' || /html/.test(mime) || /^<(!doctype html|html)\b/.test(start)) return 'html';
  if (mime.startsWith('text/') || /^(txt|text|md|markdown)$/.test(ext) || !head.subarray(0, 512).includes(0)) return 'text';
  return null;
}

const htmlTitle = (html: string) =>
  html.match(/<title\b[^>]*>([\s\S]*?)<\/title>/i)?.[1].replace(/\s+/g, ' ').trim() || null;

async function parse(src: Source, extractor: Extractor, onProgress?: OnProgress): Promise<ImportedDocument> {
  const bytes = await src.bytes();
  const type = detectType(src.name, src.mime, bytes.subarray(0, 1024));
  if (!type) throw new Error('Unsupported file type');

  let title = stripExtension(src.name);
  let text: string;
  let cover: EpubCover | null = null;
  let chapters: ChapterMark[] | undefined;
  if (type === 'epub') {
    onProgress?.('Opening book…');
    const book = readEpub(bytes);
    if (book.title) title = book.title;
    cover = book.cover;
    const texts: string[] = JSON.parse(await extractor.extract('book', JSON.stringify(book.chapters.map((c) => c.html))));
    ({ text, chapters } = joinChapters(book.chapters, texts));
  } else if (type === 'pdf') {
    onProgress?.('Reading PDF…');
    text = await extractor.extract('pdf', bytesToBase64(bytes), onProgress);
  } else if (type === 'html') {
    const html = await src.text();
    title = htmlTitle(html) || title;
    text = await extractor.extract('html', html);
  } else {
    text = await src.text();
  }
  const kind: ImportKind = type === 'epub' ? 'book' : 'file';
  return { title, cover, chapters, kind, text: text.length > MAX_CHARS ? text.slice(0, MAX_CHARS) : text };
}

/**
 * Opens the system file picker for a document ('file') or an EPUB ('book').
 * Resolves to the imported document, or null when cancelled.
 */
export async function importDocument(
  kind: ImportKind,
  extractor: Extractor,
  onProgress?: OnProgress
): Promise<ImportedDocument | null> {
  const result = await DocumentPicker.getDocumentAsync({ type: PICKER_TYPES[kind], copyToCacheDirectory: true });
  if (result.canceled || !result.assets?.length) return null;
  const asset = result.assets[0];
  return parse(
    { name: asset.name || 'File', mime: asset.mimeType || '', bytes: () => readBytes(asset), text: () => readText(asset) },
    extractor,
    onProgress
  );
}

/** Whether the text is a web address that importFromUrl can download. */
export function isUrl(text: string) {
  try {
    return /^https?:$/.test(new URL(text.trim()).protocol);
  } catch {
    return false;
  }
}

// The file's name: from Content-Disposition when the server gives one, else the URL's last part.
function nameFromResponse(url: string, disposition: string | null) {
  const encoded = disposition?.match(/filename\*\s*=\s*[^']*'[^']*'([^;]+)/i)?.[1];
  const plain = disposition?.match(/filename\s*=\s*"?([^";]+)"?/i)?.[1];
  try {
    if (encoded) return decodeURIComponent(encoded.trim());
    if (plain) return plain.trim();
    const { pathname, hostname } = new URL(url);
    return decodeURIComponent(pathname.split('/').filter(Boolean).pop() || '') || hostname;
  } catch {
    return plain?.trim() || 'Download';
  }
}

// Decodes a download in the charset the server or the page declares; UTF-8 when neither does,
// unless the bytes aren't valid UTF-8, which almost always means Windows-1252.
function decodeText(bytes: Uint8Array, contentType: string) {
  const head = latin1(bytes.subarray(0, 1024));
  const charset = (
    contentType.match(/charset\s*=\s*"?([\w-]+)/i)?.[1] ||
    head.match(/<meta\b[^>]*charset\s*=\s*["']?([\w-]+)/i)?.[1] ||
    ''
  ).toLowerCase();
  if (/^(iso-8859-1|latin-?1|windows-1252|cp1252|us-ascii|ascii)$/.test(charset)) return latin1(bytes);
  if (charset && !/^utf-?8$/.test(charset) && typeof TextDecoder !== 'undefined') {
    try {
      return new TextDecoder(charset).decode(bytes);
    } catch {
      /* unknown to this platform: try UTF-8 */
    }
  }
  const text = strFromU8(bytes);
  return !charset && text.includes('\uFFFD') ? latin1(bytes) : text;
}

/** Downloads a book, document or web page and turns it into plain text, like importDocument. */
export async function importFromUrl(url: string, extractor: Extractor, onProgress?: OnProgress): Promise<ImportedDocument> {
  onProgress?.('Downloading…');
  const res = await fetch(url.trim());
  if (!res.ok) throw new Error(`Download failed (${res.status})`);
  const bytes = new Uint8Array(await res.arrayBuffer());
  const contentType = res.headers.get('content-type') || '';
  const mime = contentType.split(';')[0].trim().toLowerCase();
  const name = nameFromResponse(res.url || url, res.headers.get('content-disposition'));
  return parse({ name, mime, bytes: async () => bytes, text: async () => decodeText(bytes, contentType) }, extractor, onProgress);
}
