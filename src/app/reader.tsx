// Reader: progress on top, the page (paused) or the RSVP stage (playing) in the middle,
// controls and speed at the bottom.
import { useKeepAwake } from 'expo-keep-awake';
import { router } from 'expo-router';
import { memo, useCallback, useEffect, useState, type ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ArrowLeftIcon, ArrowRightIcon, PauseIcon, RestartIcon } from '@/components/icons';
import PageView from '@/components/page-view';
import SpeedSlider from '@/components/speed-slider';
import Stage from '@/components/stage';
import { clamp, colors, shadows } from '@/constants/theme';
import { useReaderContext } from '@/context/reader-context';
import { confirm } from '@/lib/confirm';
import { getLibraryItem } from '@/lib/library';
import { formatNumber } from '@/lib/rsvp';

function CircleButton({ label, onPress, children }: { label: string; onPress: () => void; children: ReactNode }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      hitSlop={6}
      style={({ pressed }) => [styles.circle, pressed && styles.pressed]}
    >
      {children}
    </Pressable>
  );
}

// Opened from a deep link or a web refresh there is nothing to go back to, so go home instead.
const goBack = () => (router.canGoBack() ? router.back() : router.replace('/'));

type ProgressProps = { index: number; total: number; progress: number; timeLeft: string };

// Word position and words left; tap to switch to percentage and time left.
const ProgressHeader = memo(function ProgressHeader({ index, total, progress, timeLeft }: ProgressProps) {
  const [showTime, setShowTime] = useState(false);
  const left = showTime ? `${Math.round(progress * 100)}%` : formatNumber(Math.min(index + 1, total));
  const right = showTime ? timeLeft : `${formatNumber(total - Math.min(index, total))} left`;
  return (
    <Pressable
      style={styles.progress}
      onPress={() => setShowTime((v) => !v)}
      accessibilityRole="button"
      accessibilityLabel={`Word ${Math.min(index + 1, total)} of ${total}, ${timeLeft}`}
      accessibilityHint="Switches between words and time left"
    >
      <View style={styles.progressRow}>
        <Text style={styles.progressText}>{left}</Text>
        <Text style={styles.progressText}>{right}</Text>
      </View>
      <View style={styles.bar}>
        <View style={[styles.barFill, { width: `${progress * 100}%` }]} />
      </View>
    </Pressable>
  );
});

type ControlsProps = { label: string; running: boolean; onAction: () => void; onRestart: () => void };

// Back, the main action (Let's Go / Continue / Pause) and start over. Its props only
// change when playback starts or stops, so it doesn't re-render per word.
const Controls = memo(function Controls({ label, running, onAction, onRestart }: ControlsProps) {
  return (
    <View style={styles.controls}>
      <CircleButton label="Back" onPress={goBack}>
        <ArrowLeftIcon color={colors.textPrimary} size={22} />
      </CircleButton>
      <Pressable accessibilityRole="button" onPress={onAction} style={({ pressed }) => [styles.pill, pressed && styles.pressed]}>
        {running ? <PauseIcon color={colors.btnPrimaryFg} size={22} /> : <ArrowRightIcon color={colors.btnPrimaryFg} />}
        <Text style={styles.pillText}>{label}</Text>
      </Pressable>
      <CircleButton label="Start over" onPress={onRestart}>
        <RestartIcon color={colors.textPrimary} size={22} />
      </CircleButton>
    </View>
  );
});

export default function ReaderScreen() {
  const reader = useReaderContext();
  const { words, index, progress, timeLeft, wpm, playing, countdown, status } = reader;
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  useKeepAwake();

  // However the screen is left (library button, back gesture, Android back), stop reading.
  const { pause, cancelCountdown } = reader;
  useEffect(() => () => {
    pause();
    cancelCountdown();
  }, [pause, cancelCountdown]);

  const chapters = reader.source.id ? getLibraryItem(reader.source.id)?.chapters : undefined;
  const total = words.length;
  const done = index >= total;
  const running = playing || countdown !== null;

  let action: { label: string; run: () => void };
  if (running) action = { label: 'Pause', run: countdown !== null ? reader.cancelCountdown : reader.pause };
  else if (done) action = { label: 'Read again', run: reader.startCountdown };
  else if (index === 0) action = { label: "Let's Go!", run: reader.startCountdown };
  else action = { label: 'Continue', run: reader.play };

  const jumpTo = (i: number) =>
    confirm({
      title: 'Jump to word?',
      message: `Jump to "${words[i]}"?`,
      confirmText: 'Jump',
      onConfirm: () => reader.seekTo(i),
    });

  // Starting over throws away the reading position, so ask first (unless there's nothing to lose).
  // Kept stable so Controls doesn't re-render per word.
  const { restart } = reader;
  const atStart = index === 0;
  const confirmRestart = useCallback(() => {
    if (atStart) return restart();
    confirm({
      title: 'Start over?',
      message: 'This takes you back to the beginning and resets your progress.',
      confirmText: 'Start over',
      onConfirm: restart,
    });
  }, [atStart, restart]);

  return (
    <View style={[styles.screen, { paddingTop: insets.top + 8, paddingBottom: insets.bottom + 12 }]}>
      <ProgressHeader index={index} total={total} progress={progress} timeLeft={timeLeft} />

      <View style={styles.middle}>
        {running ? (
          <Stage
            word={reader.currentWord}
            fontSize={clamp(52, width * 0.1, 116)}
            countdown={countdown}
            status={status}
            onPress={reader.toggle}
            onHold={reader.hold}
            onRelease={reader.release}
          />
        ) : (
          <View style={styles.pageWrap}>
            <PageView
              words={words}
              index={index}
              title={reader.source.id ? reader.source.label : undefined}
              chapters={chapters}
              onWordPress={jumpTo}
            />
          </View>
        )}
      </View>

      <Controls label={action.label} running={running} onAction={action.run} onRestart={confirmRestart} />

      <View style={styles.slider}>
        <SpeedSlider value={wpm} onChange={reader.setWpm} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bgScreen },

  progress: { paddingHorizontal: 40, paddingVertical: 6 },
  progressRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  progressText: { fontSize: 16, color: colors.textSecondary, fontVariant: ['tabular-nums'] },
  bar: { height: 8, borderRadius: 4, backgroundColor: '#2A2A2A', overflow: 'hidden' },
  barFill: { height: '100%', borderRadius: 4, backgroundColor: colors.textPrimary },

  middle: { flex: 1 },
  pageWrap: { flex: 1, paddingHorizontal: 32, paddingTop: 32, paddingBottom: 16 },

  controls: { flexDirection: 'row', alignItems: 'center', gap: 13, paddingHorizontal: 16, paddingTop: 8 },
  circle: {
    width: 50,
    height: 50,
    borderRadius: 25,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: '#1B1B1B',
    boxShadow: shadows.small,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pill: {
    flex: 1,
    height: 50,
    borderRadius: 25,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.btnPrimaryBg,
    boxShadow: shadows.regular,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  pillText: { fontSize: 20, fontWeight: '600', color: colors.btnPrimaryFg },
  pressed: { transform: [{ scale: 0.96 }] },

  slider: { paddingHorizontal: 16, paddingTop: 20 },
});
