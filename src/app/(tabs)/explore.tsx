// Explore: books to discover on top, then rows of articles, essays and more.
import { ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BookCover, ItemCard, PAD, SectionHeader, Shelf } from '@/components/explore-cards';
import { colors } from '@/constants/theme';
import { PLACEHOLDER_FEED } from '@/lib/explore';

const MAX_ITEM_WIDTH = 320;

export default function ExploreScreen() {
  const insets = useSafeAreaInsets();
  // Wide enough to read, narrow enough that the next card peeks in.
  const itemWidth = Math.min(useWindowDimensions().width * 0.72, MAX_ITEM_WIDTH);
  const { books, sections } = PLACEHOLDER_FEED;

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={[styles.content, { paddingTop: insets.top, paddingBottom: insets.bottom + 32 }]}
    >
      <View style={styles.header}>
        <Text style={styles.title} accessibilityRole="header">Explore</Text>
      </View>

      <View>
        <SectionHeader title={books.title} action={books.action} />
        <Shelf>
          {books.items.map((book) => <BookCover key={book.id} book={book} />)}
        </Shelf>
      </View>

      {sections.map((section) => (
        <View key={section.id}>
          <SectionHeader title={section.title} icon={section.icon} action={section.action} />
          <Shelf>
            {section.items.map((item) => <ItemCard key={item.id} item={item} width={itemWidth} />)}
          </Shelf>
        </View>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bgScreen },
  content: { gap: 32 },
  header: { height: 64, alignItems: 'center', justifyContent: 'center', paddingHorizontal: PAD, marginBottom: -16 },
  title: { fontSize: 18, fontWeight: '600', color: colors.textPrimary },
});
