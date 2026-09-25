// The RSVP stage: one word at a time, its focal letter pinned at FOCAL_RATIO of the width,
// between two guide lines with ticks marking the focal column.
import { memo, useRef, useState, type ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View, type LayoutChangeEvent, type TransformsStyle } from 'react-native';

import { colors, fonts } from '@/constants/theme';
import { FOCAL_RATIO, splitWord } from '@/lib/rsvp';

const PAD = 10;

type Widths = { before: number; focal: number; after: number };
type Transform = { key: string; value: NonNullable<TransformsStyle['transform']> };

const NO_TRANSFORM: Transform = { key: '', value: [] };

// Shrink words that don't fit on both sides of the focal letter. Very long words are
// centred in the stage and shrunk to fit instead, like the web reader.
function fitTransform(stageW: number, { before, focal, after }: Widths): Transform {
  if (!stageW || !focal) return NO_TRANSFORM;
  const focalX = stageW * FOCAL_RATIO;
  const anchored = Math.min(1, (focalX - PAD) / (before + focal / 2), (stageW - focalX - PAD) / (after + focal / 2));
  if (anchored >= 1) return NO_TRANSFORM;
  if (anchored >= 0.6) return { key: `s${anchored.toFixed(3)}`, value: [{ scale: anchored }] };
  const fit = Math.min(1, (stageW - 2 * PAD) / (before + focal + after));
  const shift = stageW / 2 - focalX - (fit * (after - before)) / 2;
  return { key: `f${fit.toFixed(3)}:${shift.toFixed(1)}`, value: [{ translateX: shift }, { scale: fit }] };
}

// Centres its child on x, however wide the child is.
function CenterOn({ x, span, children }: { x: number; span: number; children: ReactNode }) {
  return (
    <View style={[styles.centerOn, { left: x - span, width: span * 2 }]}>
      {children}
    </View>
  );
}

type Props = {
  word: string;
  fontSize: number;
  countdown: number | null;
  status: string;
  onPress: () => void;
};

export default memo(function Stage({ word, fontSize, countdown, status, onPress }: Props) {
  const [size, setSize] = useState({ width: 0, height: 0 });
  // Measured widths live in a ref: most words need no scaling, so a new measurement only
  // causes a re-render when the transform actually changes.
  const widths = useRef<Widths>({ before: 0, focal: 0, after: 0 });
  const [transform, setTransform] = useState(NO_TRANSFORM);

  const { width: stageW, height: stageH } = size;
  const focalX = stageW * FOCAL_RATIO;
  const sideW = stageW * 4;
  const { before, focal, after } = splitWord(word);

  const measure = (part: keyof Widths, e: LayoutChangeEvent) => {
    widths.current[part] = e.nativeEvent.layout.width;
    const next = fitTransform(stageW, widths.current);
    setTransform((prev) => (prev.key === next.key ? prev : next));
  };

  const centerY = stageH / 2;
  const offset = fontSize * 0.95;
  const tick = fontSize * 0.4;
  const wordStyle = [styles.word, { fontSize, lineHeight: fontSize, letterSpacing: -0.02 * fontSize }];
  const counting = countdown !== null;

  return (
    <Pressable
      style={styles.stage}
      onPress={onPress}
      onLayout={(e) => {
        const { width, height } = e.nativeEvent.layout;
        setSize((prev) => (prev.width === width && prev.height === height ? prev : { width, height }));
      }}
      accessibilityRole="button"
      accessibilityLabel="Reader. Tap to pause or resume."
    >
      {stageW > 0 && (
        <>
          <View style={[styles.guide, { top: centerY - offset }]} />
          <View style={[styles.guide, { top: centerY + offset }]} />
          <View style={[styles.tick, { left: focalX - 1.5, top: centerY - offset, height: tick }]} />
          <View style={[styles.tick, { left: focalX - 1.5, top: centerY + offset - tick, height: tick }]} />

          {/* [before | focal | after], with both sides the same fixed width, so the row's centre
              is always the focal letter's centre. The sides are wide enough that even very long
              words fit unclipped, so they can be measured and shrunk. */}
          <CenterOn x={focalX} span={sideW + stageW}>
            <View style={[styles.row, { transform: transform.value }, counting && styles.hidden]} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
              <View style={[styles.beforeSide, { width: sideW }]}>
                <Text style={wordStyle} numberOfLines={1} onLayout={(e) => measure('before', e)}>{before}</Text>
              </View>
              <Text style={[wordStyle, styles.focal]} onLayout={(e) => measure('focal', e)}>{focal}</Text>
              <View style={[styles.afterSide, { width: sideW }]}>
                <Text style={wordStyle} numberOfLines={1} onLayout={(e) => measure('after', e)}>{after}</Text>
              </View>
            </View>
          </CenterOn>

          {counting && (
            <CenterOn x={focalX} span={stageW}>
              <Text style={[wordStyle, styles.focal]}>{countdown}</Text>
            </CenterOn>
          )}
        </>
      )}
      <Text style={[styles.status, !status && styles.hidden]} accessibilityLiveRegion="polite">
        {status}
      </Text>
    </Pressable>
  );
});

const styles = StyleSheet.create({
  stage: { flex: 1, overflow: 'hidden' },
  guide: { position: 'absolute', left: 0, right: 0, height: 3, borderRadius: 2, backgroundColor: colors.focalLine },
  tick: { position: 'absolute', width: 3, borderRadius: 2, backgroundColor: colors.focalLine },
  centerOn: { position: 'absolute', pointerEvents: 'none', top: 0, bottom: 0, alignItems: 'center', justifyContent: 'center' },
  word: {
    fontFamily: fonts.display,
    color: colors.textPrimary,
    includeFontPadding: false,
  },
  focal: { color: colors.highlight },
  row: { flexDirection: 'row', alignItems: 'flex-start' },
  beforeSide: { alignItems: 'flex-end' },
  afterSide: { alignItems: 'flex-start' },
  hidden: { opacity: 0 },
  status: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 22,
    textAlign: 'center',
    fontSize: 11,
    letterSpacing: 2,
    textTransform: 'uppercase',
    color: colors.textTertiary,
  },
});
