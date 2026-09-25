// Core RSVP (rapid serial visual presentation) logic, independent of React.

// Horizontal position of the focal letter, as a fraction of the stage width.
export const FOCAL_RATIO = 0.35;
export const WPM_MIN = 100;
export const WPM_MAX = 1000;
export const WPM_STEP = 10;
export const WPM_DEFAULT = 250;
const MIN_INTERVAL = 0.03; // seconds

export function tokenize(text: string): string[] {
  return text.replace(/\s+/g, ' ').trim().split(' ').filter(Boolean);
}

export function clampWpm(v: number): number {
  return Math.max(WPM_MIN, Math.min(WPM_MAX, Math.round(v / WPM_STEP) * WPM_STEP));
}

// The optimal recognition point: the letter the eye should land on.
export function focalLetterIndex(wordLength: number): number {
  if (wordLength <= 1) return 0;
  if (wordLength <= 5) return 1;
  if (wordLength <= 9) return 2;
  if (wordLength <= 13) return 3;
  return 4;
}

export function splitWord(word: string) {
  const i = focalLetterIndex(word.length);
  return { before: word.slice(0, i), focal: word[i] ?? '', after: word.slice(i + 1) };
}

const QUOTE_STRIP_RE = /^["'“”‘’(\[]+|["'“”‘’)\]]+$/g;
const PUNCT_RE = /[.!?,;:]$/;

// How many "beats" (60 / wpm seconds) a word stays up: longer words and words ending a
// clause stay up longer.
export function wordWeight(word: string): number {
  const stripped = word.replace(QUOTE_STRIP_RE, '');
  const n = stripped.length;
  const lengthFactor = n <= 2 ? 0.7 : n <= 5 ? 1.0 : n <= 8 ? 1.3 : n <= 12 ? 1.6 : 2.0;
  return PUNCT_RE.test(stripped) ? lengthFactor * 2 : lengthFactor;
}

// Seconds to show a word.
export function intervalForWord(word: string, wpm: number): number {
  return Math.max((60 / wpm) * wordWeight(word), MIN_INTERVAL);
}

// weightsFrom[i] = total weight of words i..end, so time left is a lookup, not a scan.
// Built once per text.
export function buildWeightsFrom(words: string[]): Float64Array {
  const out = new Float64Array(words.length + 1);
  for (let i = words.length - 1; i >= 0; i--) out[i] = out[i + 1] + wordWeight(words[i]);
  return out;
}

// Seconds left from word `from`. Exact within the slider's range: the shortest weight (0.7)
// at WPM_MAX gives 0.042 s, above MIN_INTERVAL, so the clamp never applies.
export function secondsLeft(weightsFrom: Float64Array, from: number, wpm: number): number {
  return (weightsFrom[Math.min(from, weightsFrom.length - 1)] * 60) / wpm;
}

export function formatDuration(sec: number): string {
  if (sec < 60) return Math.max(1, Math.round(sec)) + ' sec';
  const min = Math.round(sec / 60);
  if (min < 60) return min + ' min';
  const h = Math.floor(min / 60);
  const m = min % 60;
  return h + ' h' + (m ? ' ' + m + ' min' : '');
}

// 12345 -> "12,345". Written out because toLocaleString is slow on Hermes, and this runs every word.
export const formatNumber = (n: number) => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
