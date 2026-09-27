// Core RSVP (rapid serial visual presentation) logic, independent of React.

// Horizontal position of the focal letter, as a fraction of the stage width.
export const FOCAL_RATIO = 0.35;
export const WPM_MIN = 100;
export const WPM_MAX = 1000;
export const WPM_STEP = 10;
export const WPM_DEFAULT = 250;
// The screen only changes once a frame (60 Hz; 120 Hz screens divide it evenly).
const FRAME = 1 / 60; // seconds

export function tokenize(text: string): string[] {
  return text.replace(/\s+/g, ' ').trim().split(' ').filter(Boolean);
}

export function clampWpm(v: number): number {
  return Math.max(WPM_MIN, Math.min(WPM_MAX, Math.round(v / WPM_STEP) * WPM_STEP));
}

// The optimal recognition point: the letter the eye should land on, counted in letters.
export function focalLetterIndex(wordLength: number): number {
  if (wordLength <= 1) return 0;
  if (wordLength <= 5) return 1;
  if (wordLength <= 9) return 2;
  if (wordLength <= 13) return 3;
  return 4;
}

// Quotes, brackets and punctuation around a word. They're not part of what the eye reads, so the
// focal letter and a word's length are counted without them.
const WRAP = new Set('"\'“”‘’„«»‹›()[]{}<>¿¡.,;:!?…—–-*_');

// Where the word's letters start and end, without the wrapping around them. A word that is
// nothing but punctuation ("—") is all core.
function core(word: string) {
  let start = 0;
  let end = word.length;
  while (start < end && WRAP.has(word[start])) start++;
  while (end > start && WRAP.has(word[end - 1])) end--;
  return start < end ? { start, end } : { start: 0, end: word.length };
}

export function splitWord(word: string) {
  const { start, end } = core(word);
  const i = start + focalLetterIndex(end - start);
  return { before: word.slice(0, i), focal: word[i] ?? '', after: word.slice(i + 1) };
}

const CLOSE_RE = /["'“”‘’»›)\]}]+$/;
const SENTENCE_END_RE = /[.!?…]$/;
// How much longer a word ending a sentence stays up. Nothing else pauses.
const SENTENCE_PAUSE = 1.5;

// How many beats a word stays up relative to others: longer words stay up longer, and a word
// ending a sentence a little longer still. Not yet scaled to the text (see buildWeights).
export function wordWeight(word: string): number {
  const { start, end } = core(word);
  const n = end - start;
  const lengthFactor = n <= 2 ? 0.7 : n <= 5 ? 1.0 : n <= 8 ? 1.3 : n <= 12 ? 1.6 : 2.0;
  return SENTENCE_END_RE.test(word.replace(CLOSE_RE, '')) ? lengthFactor * SENTENCE_PAUSE : lengthFactor;
}

// Each word's weight, scaled so they average 1. That way a text of N words takes N minutes / wpm,
// so the speed shown is the speed read: unscaled, the pauses and long words make the real speed
// slower than the one set.
export function buildWeights(words: string[]): Float64Array {
  const out = new Float64Array(words.length);
  let sum = 0;
  for (let i = 0; i < words.length; i++) sum += out[i] = wordWeight(words[i]);
  const mean = sum / words.length;
  for (let i = 0; i < out.length; i++) out[i] /= mean;
  return out;
}

// Seconds to show a word of the given weight, as a whole number of frames. A word can only be on
// screen for whole frames, so a fractional interval (3.6 frames at 1000 wpm) would show equal
// words for 3 frames, then 4, in an uneven rhythm that reads as stutter at high speeds.
// Rounding alone drifts from the set speed (1000 wpm reads at ~1100), so the frames rounded off
// one word are carried into the next: `carry` in, the new remainder out, both in frames.
export function intervalFor(weight: number, wpm: number, carry = 0): { seconds: number; carry: number } {
  const exact = ((60 / wpm) * weight) / FRAME + carry;
  const frames = Math.max(1, Math.round(exact));
  return { seconds: frames * FRAME, carry: exact - frames };
}

// weightsFrom[i] = total weight of words i..end, so time left is a lookup, not a scan.
// Built once per text.
export function buildWeightsFrom(weights: Float64Array): Float64Array {
  const out = new Float64Array(weights.length + 1);
  for (let i = weights.length - 1; i >= 0; i--) out[i] = out[i + 1] + weights[i];
  return out;
}

// Seconds left from word `from`. Leaves out the rounding to whole frames, which intervalFor
// carries forward so it evens out.
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
