// Library home: import a file, import a book, or insert text.
import { router } from 'expo-router';
import { useRef, useState, type ComponentType } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BooksIcon, FileImportIcon, TextLinesIcon, type IconProps } from '@/components/icons';
import TextExtractor from '@/components/text-extractor';
import { colors, shadows } from '@/constants/theme';
import { useReaderActions } from '@/context/reader-context';
import { importDocument, type Extractor, type ImportKind } from '@/lib/files';

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
  const extractorRef = useRef<Extractor>(null);
  const [busy, setBusy] = useState<string | null>(null); // progress message while importing
  const [error, setError] = useState<string | null>(null);

  const importKind = async (kind: ImportKind) => {
    setError(null);
    try {
      const doc = await importDocument(kind, extractorRef.current!, setBusy);
      if (!doc) return;
      if (!reader.loadText(doc.text, doc.title)) {
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

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
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

      <TextExtractor ref={extractorRef} />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bgScreen },
  header: { height: 64, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 18, fontWeight: '600', color: colors.textPrimary },
  tiles: {
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: 16,
    paddingTop: 12,
    width: '100%',
    maxWidth: 560,
    alignSelf: 'center',
  },
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
  status: { paddingTop: 24, paddingHorizontal: 22, alignItems: 'center' },
  busy: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  statusText: { fontSize: 14, color: colors.textTertiary, textAlign: 'center' },
});
