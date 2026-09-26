// The text as a page: read words grey, the rest white, the current word with its focal letter
// in red. Tap a word to jump to it; swipe left or right to turn the page. In a book, the chapter's
// name heads each page and every chapter starts on a new page; anything else (and a book's pages
// before its first chapter) is headed by its title.
import { useMemo, useRef, useState, type ReactNode } from 'react';
import { StyleSheet, Text, View, type GestureResponderEvent, type ViewProps } from 'react-native';

import { DocumentIcon } from '@/components/icons';
import { colors, fonts } from '@/constants/theme';
import type { ChapterMark } from '@/lib/files';
import { splitWord, tokenize } from '@/lib/rsvp';

const FONT_SIZE = 18;
const LINE_HEIGHT = 23;
const SWIPE_MIN = 40;
// Text used once to measure the font's average character width.
const SAMPLE = 'Reading is different. The more complete ideas you take in, the more knowledge you have to draw from.';
// Word widths are estimated from an average, so leave room for wide words.
const WIDTH_SAFETY = 0.93;
// The chapter header is one line tall whatever the name, so pages can be laid out ahead. The title
// header's height is measured, as the title can take two lines.
const CHAPTER_HEADER_HEIGHT = 88;
const NO_CHAPTERS: ChapterMark[] = [];

// The chapter that word i is in, if any.
function chapterAt(chapters: ChapterMark[], i: number) {
  let found: ChapterMark | undefined;
  for (const c of chapters) {
    if (c.index > i) break;
    found = c;
  }
  return found;
}

// Splits the text into pages by simulating line wrapping. Returns each page's first word index.
// `headerFrom(i)` is the height of the header on a page starting at word i.
function paginate(
  words: string[],
  charW: number,
  width: number,
  height: number,
  chapters: ChapterMark[],
  headerFrom: (i: number) => number
) {
  const lineW = width * WIDTH_SAFETY;
  const breaks = new Set(chapters.map((c) => c.index));
  const linesFrom = (i: number) => Math.max(1, Math.floor((height - headerFrom(i)) / LINE_HEIGHT));
  const starts = [0];
  let linesPerPage = linesFrom(0);
  let line = 1;
  let x = 0;
  for (let i = 0; i < words.length; i++) {
    const w = words[i].length * charW;
    if (i > 0 && breaks.has(i)) {
      starts.push(i);
      linesPerPage = linesFrom(i);
      line = 1;
      x = w;
      continue;
    }
    if (x === 0 || x + charW + w <= lineW) {
      x += (x === 0 ? 0 : charW) + w;
      continue;
    }
    // Start a new line, and a new page when this one is full.
    line++;
    if (line > linesPerPage) {
      starts.push(i);
      linesPerPage = linesFrom(i);
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

// How many words the chapter's text opens with that repeat its name, which the header already shows.
function repeatedTitle(words: string[], chapter: ChapterMark) {
  const norm = (w: string) => w.toLowerCase().replace(/[^\p{L}\p{N}]/gu, '');
  const title = tokenize(chapter.title).map(norm).filter(Boolean);
  let n = 0;
  for (let t = 0; t < title.length; n++) {
    const w = words[chapter.index + n];
    if (w === undefined) return 0;
    const word = norm(w);
    if (!word) continue; // a lone dash or ornament between words
    if (word !== title[t]) return 0;
    t++;
  }
  return n;
}

function ChapterHeader({ title }: { title: string }) {
  return (
    <View style={styles.chapter} accessibilityRole="header">
      <Text style={styles.chapterLabel}>Chapter</Text>
      <Text style={styles.chapterTitle} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.6}>
        {title}
      </Text>
      <View style={styles.chapterRule} />
    </View>
  );
}

function TitleHeader({ title }: { title: string }) {
  return (
    <View style={styles.title} accessibilityRole="header">
      <DocumentIcon color={colors.textPrimary} />
      <Text style={styles.titleText} numberOfLines={2}>
        {title}
      </Text>
    </View>
  );
}

type Props = {
  words: string[];
  index: number;
  /** Heads pages that aren't in a chapter. */
  title?: string;
  chapters?: ChapterMark[];
  onWordPress: (i: number) => void;
};

export default function PageView({ words, index, title, chapters = NO_CHAPTERS, onWordPress }: Props) {
  const [size, setSize] = useState<{ width: number; height: number } | null>(null);
  const [charW, setCharW] = useState(0);
  const [titleH, setTitleH] = useState(0);
  // Pages turned away from the current word; resets whenever the reading position moves.
  const [turn, setTurn] = useState({ index, offset: 0 });
  const touchStart = useRef<{ x: number; y: number } | null>(null);

  const ready = size && charW && (!title || titleH);
  const starts = useMemo(() => {
    if (!ready) return [0];
    const headerFrom = (i: number) => (chapterAt(chapters, i) ? CHAPTER_HEADER_HEIGHT : title ? titleH : 0);
    return paginate(words, charW, size.width, size.height, chapters, headerFrom);
  }, [ready, words, charW, size, chapters, title, titleH]);

  const current = pageOf(starts, Math.min(index, words.length - 1));
  const offset = turn.index === index ? turn.offset : 0;
  const page = Math.max(0, Math.min(starts.length - 1, current + offset));
  const from = starts[page];
  const to = page + 1 < starts.length ? starts[page + 1] : words.length;
  const chapter = chapterAt(chapters, from);
  // On a chapter's first page, leave out its name at the top of the text, unless it's being read.
  const skip = chapter && chapter.index === from ? repeatedTitle(words, chapter) : 0;
  const first = index >= from && index < from + skip ? from : from + skip;

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
  for (let i = first; i < to; i++) {
    if (i > first) spans.push(' ');
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
      {!!title && (
        <View style={styles.measureHeader} onLayout={(e) => setTitleH(e.nativeEvent.layout.height)}>
          <TitleHeader title={title} />
        </View>
      )}
      {ready ? (
        <>
          {chapter ? <ChapterHeader title={chapter.title} /> : !!title && <TitleHeader title={title} />}
          <Text style={styles.text}>{spans}</Text>
        </>
      ) : null}
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
  measureHeader: { position: 'absolute', top: 0, left: 0, right: 0, opacity: 0, pointerEvents: 'none' },
  chapter: { height: CHAPTER_HEADER_HEIGHT, justifyContent: 'flex-end' },
  chapterLabel: { fontSize: 12, lineHeight: 16, letterSpacing: 1.5, color: colors.textTertiary },
  chapterTitle: {
    fontFamily: fonts.display,
    fontSize: 28,
    lineHeight: 34,
    marginTop: 2,
    color: colors.textPrimary,
    includeFontPadding: false,
  },
  chapterRule: { height: 1, marginTop: 12, marginBottom: 18, backgroundColor: colors.divider },
  title: { alignItems: 'center', gap: 14, paddingBottom: 32 },
  titleText: {
    fontSize: 17,
    lineHeight: 23,
    fontWeight: '700',
    letterSpacing: 0.3,
    textAlign: 'center',
    textTransform: 'uppercase',
    color: colors.textPrimary,
  },
  read: { color: '#6E6E6E' },
  focal: { color: colors.highlight },
});
