// Speed slider: a dark track with a tick every 100 wpm and a pill thumb showing the speed.
import { memo, useRef, useState } from 'react';
import { StyleSheet, Text, View, type GestureResponderEvent, type ViewProps } from 'react-native';

import { colors, shadows } from '@/constants/theme';
import { WPM_MAX, WPM_MIN, WPM_STEP } from '@/lib/rsvp';

const HEIGHT = 36;
const THUMB_W = 70;
const TICKS = (WPM_MAX - WPM_MIN) / 100 + 1;

type Props = { value: number; onChange: (wpm: number) => void };

export default memo(function SpeedSlider({ value, onChange }: Props) {
  const [width, setWidth] = useState(0);
  const trackPageX = useRef(0);
  const travel = Math.max(0, width - THUMB_W);

  const update = (pageX: number) => {
    if (!travel) return;
    const pct = Math.max(0, Math.min(1, (pageX - trackPageX.current - THUMB_W / 2) / travel));
    onChange(WPM_MIN + Math.round((pct * (WPM_MAX - WPM_MIN)) / WPM_STEP) * WPM_STEP);
  };

  const responder: ViewProps = {
    onStartShouldSetResponder: () => true,
    onMoveShouldSetResponder: () => true,
    // Don't let a parent scroll view steal the drag.
    onResponderTerminationRequest: () => false,
    onResponderGrant: (e: GestureResponderEvent) => {
      // Children ignore touches, so locationX is always relative to the track.
      trackPageX.current = e.nativeEvent.pageX - e.nativeEvent.locationX;
      update(e.nativeEvent.pageX);
    },
    onResponderMove: (e: GestureResponderEvent) => update(e.nativeEvent.pageX),
  };

  const thumbLeft = ((value - WPM_MIN) / (WPM_MAX - WPM_MIN)) * travel;

  return (
    <View
      style={styles.track}
      onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
      accessible
      accessibilityRole="adjustable"
      accessibilityLabel="Reading speed in words per minute"
      accessibilityValue={{ min: WPM_MIN, max: WPM_MAX, now: value, text: `${value} words per minute` }}
      accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
      onAccessibilityAction={(e) => onChange(value + (e.nativeEvent.actionName === 'increment' ? 50 : -50))}
      {...responder}
    >
      {width > 0 && (
        <>
          {Array.from({ length: TICKS }, (_, i) => (
            <View key={i} style={[styles.tick, { left: THUMB_W / 2 + (i * travel) / (TICKS - 1) - 1 }]} />
          ))}
          <View style={[styles.thumb, { left: thumbLeft }]}>
            <Text style={styles.thumbText}>{value}</Text>
          </View>
        </>
      )}
    </View>
  );
});

const styles = StyleSheet.create({
  track: {
    height: HEIGHT,
    borderRadius: HEIGHT / 2,
    backgroundColor: '#141414',
    justifyContent: 'center',
  },
  tick: {
    position: 'absolute',
    pointerEvents: 'none',
    top: (HEIGHT - 12) / 2,
    width: 2,
    height: 12,
    borderRadius: 1,
    backgroundColor: 'rgba(255,255,255,0.16)',
  },
  thumb: {
    position: 'absolute',
    pointerEvents: 'none',
    top: 0,
    width: THUMB_W,
    height: HEIGHT,
    borderRadius: HEIGHT / 2,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.btnSecondaryBg,
    boxShadow: shadows.small,
    alignItems: 'center',
    justifyContent: 'center',
  },
  thumbText: { fontSize: 19, fontWeight: '600', color: colors.textPrimary, fontVariant: ['tabular-nums'] },
});
