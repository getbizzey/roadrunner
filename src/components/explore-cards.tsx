// The pieces of the Explore feed: section headers, book covers and item cards.
import { Image } from 'expo-image';
import { memo, type ReactNode } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { ChevronRightIcon } from '@/components/icons';
import { colors, fonts } from '@/constants/theme';
import type { ExploreBook, ExploreItem, SectionAction } from '@/lib/explore';

export const PAD = 16;
const GAP = 12;
export const BOOK_WIDTH = 124;

type HeaderProps = { title: string; icon?: string; action?: SectionAction; onAction?: () => void };

export function SectionHeader({ title, icon, action, onAction }: HeaderProps) {
  return (
    <View style={styles.header}>
      <View style={styles.headerTitle}>
        {icon && <Image source={icon} style={styles.headerIcon} tintColor={colors.textPrimary} contentFit="contain" />}
        <Text style={styles.sectionTitle} accessibilityRole="header">{title}</Text>
      </View>
      {action && (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`${action.label}, ${title}`}
          onPress={onAction}
          hitSlop={8}
          style={({ pressed }) => [styles.action, pressed && styles.dimmed]}
        >
          <Text style={styles.actionLabel}>{action.label}</Text>
          <ChevronRightIcon color={colors.textPrimary} />
        </Pressable>
      )}
    </View>
  );
}

// A horizontal row that scrolls past the screen edge, lined up with the headers.
export function Shelf({ children }: { children: ReactNode }) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.shelf}>
      {children}
    </ScrollView>
  );
}

type BookProps = { book: ExploreBook; onPress?: (book: ExploreBook) => void };

export const BookCover = memo(function BookCover({ book, onPress }: BookProps) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${book.title} by ${book.author}`}
      onPress={() => onPress?.(book)}
      style={({ pressed }) => [styles.book, pressed && styles.pressed]}
    >
      <View style={styles.cover}>
        {book.cover ? (
          <Image source={book.cover} style={StyleSheet.absoluteFill} contentFit="cover" transition={150} recyclingKey={book.id} />
        ) : (
          <Text style={styles.coverFallback} numberOfLines={4}>{book.title}</Text>
        )}
      </View>
      <Text style={styles.bookTitle} numberOfLines={1}>{book.title}</Text>
      <Text style={styles.bookAuthor} numberOfLines={1}>{book.author}</Text>
    </Pressable>
  );
});

type ItemProps = { item: ExploreItem; width: number; onPress?: (item: ExploreItem) => void };

export const ItemCard = memo(function ItemCard({ item, width, onPress }: ItemProps) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={item.subtitle ? `${item.title}, ${item.subtitle}` : item.title}
      onPress={() => onPress?.(item)}
      style={({ pressed }) => [styles.item, { width }, pressed && styles.pressed]}
    >
      <View style={styles.thumb}>
        {item.image && (
          <Image source={item.image} style={StyleSheet.absoluteFill} contentFit="cover" transition={150} recyclingKey={item.id} />
        )}
      </View>
      <View style={styles.itemBody}>
        <Text style={styles.itemTitle} numberOfLines={2}>{item.title}</Text>
        {item.subtitle && <Text style={styles.itemSubtitle} numberOfLines={2}>{item.subtitle}</Text>}
      </View>
    </Pressable>
  );
});

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: PAD, marginBottom: 12 },
  headerTitle: { flexDirection: 'row', alignItems: 'center', gap: 8, flexShrink: 1 },
  headerIcon: { width: 20, height: 20 },
  sectionTitle: { fontFamily: fonts.display, fontSize: 24, lineHeight: 28, color: colors.textPrimary },
  action: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  actionLabel: { fontSize: 14, fontWeight: '500', color: colors.textPrimary },

  shelf: { paddingHorizontal: PAD, gap: GAP },

  book: { width: BOOK_WIDTH },
  cover: {
    aspectRatio: 2 / 3,
    borderRadius: 12,
    borderCurve: 'continuous',
    backgroundColor: colors.bgCardMuted,
    overflow: 'hidden',
    justifyContent: 'flex-end',
    padding: 10,
  },
  coverFallback: { fontFamily: fonts.display, fontSize: 14, lineHeight: 17, color: colors.textSecondary },
  bookTitle: { marginTop: 8, fontSize: 15, fontWeight: '600', color: colors.textPrimary },
  bookAuthor: { marginTop: 2, fontSize: 13, color: colors.textTertiary },

  item: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 12,
    borderRadius: 20,
    borderCurve: 'continuous',
    backgroundColor: colors.bgCard,
  },
  thumb: { width: 68, height: 68, borderRadius: 8, backgroundColor: colors.bgCardMuted, overflow: 'hidden' },
  itemBody: { flex: 1, gap: 4 },
  itemTitle: { fontFamily: fonts.display, fontSize: 16, lineHeight: 19, color: colors.textPrimary },
  itemSubtitle: { fontSize: 13, lineHeight: 17, color: colors.textTertiary },

  pressed: { transform: [{ scale: 0.97 }] },
  dimmed: { opacity: 0.6 },
});
