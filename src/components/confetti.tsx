// A burst of confetti fired from the bottom corners, for finishing a text. Every piece is driven
// by one clock on the UI thread; remount (change its key) to fire again.
import { memo, useEffect, useState } from 'react';
import { StyleSheet, View, useWindowDimensions } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useReducedMotion, useSharedValue, withTiming, type SharedValue } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

const DURATION_S = 4;
const PIECES_PER_CANNON = 60;
const DRAG = 1.2; // 1/s, how quickly the launch speed bleeds off
const FALL_SPEED = 400; // px/s, the speed pieces settle into fluttering down at
const COLORS = ['#FF0000', '#FFFFFF', '#FFC700', '#2ECC71', '#3498DB', '#FF6FB5', '#B2B2B2'];

type Piece = {
  x0: number;
  y0: number;
  vx: number;
  vy: number;
  w: number;
  h: number;
  color: string;
  spin: number; // deg/s
  flip: number; // rad/s, tumbling around the horizontal axis
  sway: number; // px
  phase: number;
  delay: number; // s
};

const rand = (min: number, max: number) => min + Math.random() * (max - min);

function makePieces(width: number, height: number): Piece[] {
  const pieces: Piece[] = [];
  for (const side of [-1, 1]) {
    for (let i = 0; i < PIECES_PER_CANNON; i++) {
      // Aimed up and in, towards the middle of the screen, with some spread.
      const angle = (rand(55, 80) * Math.PI) / 180;
      const speed = rand(1.0, 1.7) * height;
      pieces.push({
        x0: side < 0 ? 0 : width,
        y0: height,
        vx: -side * Math.cos(angle) * speed,
        vy: -Math.sin(angle) * speed,
        w: rand(6, 11),
        h: rand(10, 16),
        color: COLORS[Math.floor(Math.random() * COLORS.length)],
        spin: rand(-540, 540),
        flip: rand(4, 12),
        sway: rand(8, 24),
        phase: rand(0, Math.PI * 2),
        delay: rand(0, 0.15),
      });
    }
  }
  return pieces;
}

const ConfettiPiece = memo(function ConfettiPiece({ piece: p, clock }: { piece: Piece; clock: SharedValue<number> }) {
  const style = useAnimatedStyle(() => {
    const t = Math.max(0, clock.value - p.delay);
    // Launch speed decays exponentially; vertically it settles to a gentle fall instead of zero.
    const decay = (1 - Math.exp(-DRAG * t)) / DRAG;
    const x = p.x0 + p.vx * decay + Math.sin(t * 3 + p.phase) * p.sway * Math.min(1, t);
    const y = p.y0 + FALL_SPEED * t + (p.vy - FALL_SPEED) * decay;
    const fade = Math.min(1, (DURATION_S - clock.value) / 0.8);
    return {
      opacity: t > 0 ? fade : 0,
      transform: [
        { translateX: x - p.w / 2 },
        { translateY: y - p.h / 2 },
        { rotate: `${p.spin * t}deg` },
        { scaleY: Math.cos(p.flip * t + p.phase) },
      ],
    };
  });
  return <Animated.View style={[styles.piece, { width: p.w, height: p.h, backgroundColor: p.color }, style]} />;
});

type Props = { onDone?: () => void };

export default function Confetti({ onDone }: Props) {
  const { width, height } = useWindowDimensions();
  const [pieces] = useState(() => makePieces(width, height));
  const reduceMotion = useReducedMotion();
  const clock = useSharedValue(0);

  useEffect(() => {
    if (reduceMotion) {
      onDone?.();
      return;
    }
    clock.value = withTiming(DURATION_S, { duration: DURATION_S * 1000, easing: Easing.linear }, (finished) => {
      if (finished && onDone) scheduleOnRN(onDone);
    });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  if (reduceMotion) return null;
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      {pieces.map((p, i) => (
        <ConfettiPiece key={i} piece={p} clock={clock} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  piece: { position: 'absolute', left: 0, top: 0, borderRadius: 2 },
});
