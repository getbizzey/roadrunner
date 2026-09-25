// Library home: import a file, import a book, or insert text, and everything imported so far.
import { router } from 'expo-router';
import { useCallback, useRef, useState, type ComponentType } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BooksIcon, FileImportIcon, TextLinesIcon, type IconProps } from '@/components/icons';
import LibraryCard from '@/components/library-card';
import TextExtractor from '@/components/text-extractor';
import { colors, shadows } from '@/constants/theme';
import { useReaderActions } from '@/context/reader-context';
import { confirm } from '@/lib/confirm';
import { importDocument, type Extractor, type ImportKind } from '@/lib/files';
import {
  addToLibrary,
  markOpened,
  readLibraryText,
  removeFromLibrary,
  useLibrary,
  type LibraryItem,
} from '@/lib/library';

const MAX_WIDTH = 560;
const PAD = 16;
const GAP = 16;

type TileProps = { label: string; Icon: ComponentType<IconProps>; onPress: () => void; disabled: boolean };

function Tile({ label, Icon, onPress, disabled }: TileProps) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label.replace('\n', ' ')}
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [styles.tile, pressed && styles.pressed, disabled && styles.disabled]}
    >
      <Icon color={colors.btnPrimaryFg} />
      <Text style={styles.tileLabel}>{label}</Text>
    </Pressable>
  );
}

export default function LibraryScreen() {
  const reader = useReaderActions();
  const insets = useSafeAreaInsets();
  // A set width, so a card alone on the last row is still half the list.
  const cardWidth = (Math.min(useWindowDimensions().width, MAX_WIDTH) - PAD * 2 - GAP) / 2;
  const extractorRef = useRef<Extractor>(null);
  const [busy, setBusy] = useState<string | null>(null); // progress message while importing
  const [error, setError] = useState<string | null>(null);

  const library = useLibrary();

  const importKind = async (kind: ImportKind) => {
    setError(null);
    try {
      const doc = await importDocument(kind, extractorRef.current!, setBusy);
      if (!doc) return;
      setBusy('Saving to your library…');
      const item = await addToLibrary({ ...doc, kind });
      if (!item || !reader.loadText(doc.text, item.title, { id: item.id })) {
        setError(kind === 'book' ? 'No text found in that book' : 'No text found in that file');
        return;
      }
      router.push('/reader');
    } catch {
      setError(kind === 'book' ? 'Could not read that book' : 'Could not read that file');
    } finally {
      setBusy(null);
    }
  };

  // Resumes where it was left: the reader already has it loaded, or it's read back from storage.
  const open = useCallback(
    async (item: LibraryItem) => {
      setError(null);
      if (reader.loadedId() !== item.id) {
        const text = await readLibraryText(item.id);
        if (!text || !reader.loadText(text, item.title, { id: item.id, index: item.index })) {
          setError('Could not open that. Try importing it again.');
          return;
        }
      }
      markOpened(item.id);
      router.push('/reader');
    },
    [reader]
  );

  const remove = useCallback(
    (item: LibraryItem) =>
      confirm({
        title: 'Remove from library?',
        message: `"${item.title}" and your progress in it will be removed.`,
        confirmText: 'Remove',
        onConfirm: () => removeFromLibrary(item.id),
      }),
    []
  );

  const header = (
    <>
      <View style={styles.header}>
        <Text style={styles.title} accessibilityRole="header">Reading Library</Text>
      </View>

      <View style={styles.tiles}>
        <Tile label={'Import\nFile'} Icon={FileImportIcon} onPress={() => importKind('file')} disabled={!!busy} />
        <Tile label={'Import\nBook'} Icon={BooksIcon} onPress={() => importKind('book')} disabled={!!busy} />
        <Tile label={'Insert\nText'} Icon={TextLinesIcon} onPress={() => router.push('/insert')} disabled={!!busy} />
      </View>

      <View style={styles.status} accessibilityLiveRegion="polite">
        {busy && (
          <View style={styles.busy}>
            <ActivityIndicator color={colors.textSecondary} />
            <Text style={styles.statusText}>{busy}</Text>
          </View>
        )}
        {error && <Text style={styles.statusText}>{error}</Text>}
      </View>
    </>
  );

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      <FlatList
        data={library}
        keyExtractor={(item) => item.id}
        numColumns={2}
        renderItem={({ item }) => <LibraryCard item={item} width={cardWidth} onPress={open} onLongPress={remove} />}
        ListHeaderComponent={header}
        ListEmptyComponent={
          <Text style={[styles.statusText, styles.empty]}>Books, files and texts you import will show up here.</Text>
        }
        columnWrapperStyle={styles.row}
        contentContainerStyle={[styles.list, { paddingBottom: insets.bottom + 24 }]}
        showsVerticalScrollIndicator={false}
      />

      <TextExtractor ref={extractorRef} />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bgScreen },
  header: { height: 64, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 18, fontWeight: '600', color: colors.textPrimary },
  list: { paddingHorizontal: PAD, width: '100%', maxWidth: MAX_WIDTH, alignSelf: 'center', gap: GAP },
  row: { gap: GAP },
  tiles: { flexDirection: 'row', gap: 12, paddingTop: 12 },
  tile: {
    flex: 1,
    aspectRatio: 0.92,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.btnPrimaryBg,
    boxShadow: shadows.regular,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  tileLabel: { fontSize: 15, lineHeight: 19, fontWeight: '500', textAlign: 'center', color: colors.btnPrimaryFg },
  pressed: { transform: [{ scale: 0.97 }] },
  disabled: { opacity: 0.6 },
  status: { minHeight: 16, paddingVertical: 12, paddingHorizontal: 6, alignItems: 'center' },
  empty: { paddingTop: 24, paddingHorizontal: 22 },
  busy: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  statusText: { fontSize: 14, color: colors.textTertiary, textAlign: 'center' },
});
