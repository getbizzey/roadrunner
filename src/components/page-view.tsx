// The text as a page: read words grey, the rest white, the current word with its focal letter
// in red. Tap a word to jump to it; swipe left or right to turn the page.
import { useMemo, useRef, useState, type ReactNode } from 'react';
import { StyleSheet, Text, View, type GestureResponderEvent, type ViewProps } from 'react-native';

import { colors, fonts } from '@/constants/theme';
import { splitWord } from '@/lib/rsvp';

const FONT_SIZE = 18;
const LINE_HEIGHT = 23;
const SWIPE_MIN = 40;
// Text used once to measure the font's average character width.
const SAMPLE = 'Reading is different. The more complete ideas you take in, the more knowledge you have to draw from.';
// Word widths are estimated from an average, so leave room for wide words.
const WIDTH_SAFETY = 0.93;

// Splits the text into pages by simulating line wrapping. Returns each page's first word index.
function paginate(words: string[], charW: number, width: number, height: number) {
  const lineW = width * WIDTH_SAFETY;
  const linesPerPage = Math.max(1, Math.floor(height / LINE_HEIGHT));
  const starts = [0];
  let line = 1;
  let x = 0;
  for (let i = 0; i < words.length; i++) {
    const w = words[i].length * charW;
    if (x === 0 || x + charW + w <= lineW) {
      x += (x === 0 ? 0 : charW) + w;
      continue;
    }
    // Start a new line, and a new page when this one is full.
    line++;
    if (line > linesPerPage) {
      starts.push(i);
      line = 1;
    }
    x = w;
  }
  return starts;
}

// Index of the page that contains word i.
function pageOf(starts: number[], i: number) {
  let lo = 0;
  let hi = starts.length - 1;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (starts[mid] <= i) lo = mid;
    else hi = mid - 1;
  }
  return lo;
}

type Props = { words: string[]; index: number; onWordPress: (i: number) => void };

export default function PageView({ words, index, onWordPress }: Props) {
  const [size, setSize] = useState<{ width: number; height: number } | null>(null);
  const [charW, setCharW] = useState(0);
  // Pages turned away from the current word; resets whenever the reading position moves.
  const [turn, setTurn] = useState({ index, offset: 0 });
  const touchStart = useRef<{ x: number; y: number } | null>(null);

  const starts = useMemo(
    () => (size && charW ? paginate(words, charW, size.width, size.height) : [0]),
    [words, charW, size]
  );

  const current = pageOf(starts, Math.min(index, words.length - 1));
  const offset = turn.index === index ? turn.offset : 0;
  const page = Math.max(0, Math.min(starts.length - 1, current + offset));
  const from = starts[page];
  const to = page + 1 < starts.length ? starts[page + 1] : words.length;

  const turnPage = (delta: number) => {
    const next = Math.max(0, Math.min(starts.length - 1, page + delta));
    setTurn({ index, offset: next - current });
  };

  // Horizontal drags turn the page; taps fall through to the words.
  const swipe: ViewProps = {
    onStartShouldSetResponderCapture: (e: GestureResponderEvent) => {
      touchStart.current = { x: e.nativeEvent.pageX, y: e.nativeEvent.pageY };
      return false;
    },
    onMoveShouldSetResponderCapture: (e: GestureResponderEvent) => {
      if (!touchStart.current) return false;
      const dx = e.nativeEvent.pageX - touchStart.current.x;
      const dy = e.nativeEvent.pageY - touchStart.current.y;
      return Math.abs(dx) > 12 && Math.abs(dx) > Math.abs(dy) * 1.5;
    },
    onResponderTerminationRequest: () => false,
    onResponderRelease: (e: GestureResponderEvent) => {
      if (!touchStart.current) return;
      const dx = e.nativeEvent.pageX - touchStart.current.x;
      if (Math.abs(dx) >= SWIPE_MIN) turnPage(dx < 0 ? 1 : -1);
      touchStart.current = null;
    },
  };

  const spans: ReactNode[] = [];
  for (let i = from; i < to; i++) {
    if (i > from) spans.push(' ');
    const word = words[i];
    const onPress = () => onWordPress(i);
    if (i === index) {
      const { before, focal, after } = splitWord(word);
      spans.push(
        <Text key={i} onPress={onPress} accessibilityLabel={`${word}, current word`}>
          {before}
          <Text style={styles.focal}>{focal}</Text>
          {after}
        </Text>
      );
    } else {
      spans.push(
        <Text key={i} onPress={onPress} style={i < index && styles.read}>
          {word}
        </Text>
      );
    }
  }

  return (
    <View
      style={styles.page}
      onLayout={(e) => {
        const { width, height } = e.nativeEvent.layout;
        setSize((prev) => (prev && prev.width === width && prev.height === height ? prev : { width, height }));
      }}
      {...swipe}
    >
      <View style={styles.measure}>
        <Text style={styles.text} numberOfLines={1} onLayout={(e) => setCharW(e.nativeEvent.layout.width / SAMPLE.length)}>
          {SAMPLE}
        </Text>
      </View>
      {charW > 0 && <Text style={styles.text}>{spans}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, overflow: 'hidden' },
  measure: { position: 'absolute', top: 0, left: 0, width: 10000, alignItems: 'flex-start', opacity: 0, pointerEvents: 'none' },
  text: {
    fontFamily: fonts.display,
    fontSize: FONT_SIZE,
    lineHeight: LINE_HEIGHT,
    letterSpacing: 0.3,
    textAlign: 'justify',
    color: colors.textPrimary,
    includeFontPadding: false,
  },
  read: { color: '#6E6E6E' },
  focal: { color: colors.highlight },
});
