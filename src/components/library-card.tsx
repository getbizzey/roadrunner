// One book, file or text in the library: its cover (if it has one), title, words read and progress.
import { Image } from 'expo-image';
import { memo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, fonts } from '@/constants/theme';
import { coverUri, type LibraryItem } from '@/lib/library';

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

export function timeAgo(at: number, now = Date.now()) {
  const ago = now - at;
  if (ago < MINUTE) return 'Just now';
  if (ago < HOUR) return `${Math.floor(ago / MINUTE)} min ago`;
  if (ago < DAY) return `${Math.floor(ago / HOUR)} h ago`;
  const days = Math.floor(ago / DAY);
  if (days === 1) return 'Yesterday';
  if (days < 30) return `${days} days ago`;
  return new Date(at).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
}

type Props = {
  item: LibraryItem;
  width: number;
  onPress: (item: LibraryItem) => void;
  onLongPress: (item: LibraryItem) => void;
};

export default memo(function LibraryCard({ item, width, onPress, onLongPress }: Props) {
  const cover = coverUri(item);
  const read = Math.min(item.index, item.words);
  const progress = item.words ? read / item.words : 0;
  const percent = Math.round(progress * 100);

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${item.title}, ${percent}% read`}
      accessibilityHint="Opens the reader. Long press to remove."
      accessibilityActions={[{ name: 'longpress', label: 'Remove from library' }]}
      onAccessibilityAction={(e) => e.nativeEvent.actionName === 'longpress' && onLongPress(item)}
      onPress={() => onPress(item)}
      onLongPress={() => onLongPress(item)}
      style={({ pressed }) => [styles.card, { width }, pressed && styles.pressed]}
    >
      {cover && (
        <>
          <Image source={cover} style={StyleSheet.absoluteFill} contentFit="cover" transition={150} recyclingKey={item.id} />
          <View style={[StyleSheet.absoluteFill, styles.scrim]} />
        </>
      )}
      <View style={styles.body}>
        <Text style={styles.title} numberOfLines={3}>{item.title}</Text>
        <Text style={styles.words} numberOfLines={2}>{`${read} / ${item.words} words`}</Text>
      </View>
      <View>
        <View style={styles.bar}>
          <View style={[styles.barFill, { width: `${Math.max(progress * 100, 4)}%` }]} />
        </View>
        <View style={styles.meta}>
          <Text style={styles.metaText}>{percent}%</Text>
          <Text style={styles.metaText}>{timeAgo(item.readAt)}</Text>
        </View>
      </View>
    </Pressable>
  );
});

const styles = StyleSheet.create({
  card: {
    aspectRatio: 0.95,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.bgCard,
    overflow: 'hidden',
    padding: 16,
    justifyContent: 'space-between',
  },
  scrim: { backgroundColor: 'rgba(0,0,0,0.5)' },
  body: { gap: 6 },
  title: { fontFamily: fonts.display, fontSize: 19, lineHeight: 22, color: colors.textPrimary },
  words: { fontFamily: fonts.display, fontSize: 16, lineHeight: 19, color: colors.textPrimary, fontVariant: ['tabular-nums'] },
  bar: { height: 6, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.25)', overflow: 'hidden' },
  barFill: { height: '100%', borderRadius: 3, backgroundColor: colors.textPrimary },
  meta: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 6 },
  metaText: { fontSize: 12, fontWeight: '500', color: colors.textPrimary, fontVariant: ['tabular-nums'] },
  pressed: { transform: [{ scale: 0.97 }] },
});
