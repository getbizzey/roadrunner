// Import URL: download a book, document or web page from its address, then read it.
import * as Clipboard from 'expo-clipboard';
import { router } from 'expo-router';
import { useRef, useState } from 'react';
import {
  ActivityIndicator,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ArrowRightIcon, CloseIcon } from '@/components/icons';
import TextExtractor from '@/components/text-extractor';
import { colors, shadows } from '@/constants/theme';
import { useReaderActions } from '@/context/reader-context';
import { importFromUrl, isUrl, type Extractor } from '@/lib/files';
import { addToLibrary } from '@/lib/library';

export default function ImportUrlScreen() {
  const reader = useReaderActions();
  const insets = useSafeAreaInsets();
  const extractorRef = useRef<Extractor>(null);
  const [url, setUrl] = useState('');
  const [busy, setBusy] = useState<string | null>(null); // progress message while importing
  const [hint, setHint] = useState<string | null>(null);

  const paste = async () => {
    let t = '';
    try { t = (await Clipboard.getStringAsync()).trim(); } catch { t = ''; }
    if (isUrl(t)) {
      setUrl(t);
      setHint(null);
    } else {
      setHint('No web address to paste. Copy a link first, or allow pasting when asked.');
    }
  };

  const importUrl = async () => {
    Keyboard.dismiss();
    setHint(null);
    try {
      const doc = await importFromUrl(url, extractorRef.current!, setBusy);
      setBusy('Saving to your library…');
      const item = await addToLibrary(doc);
      if (!item || !reader.loadText(doc.text, item.title, { id: item.id })) {
        setHint('No text found at that address.');
        return;
      }
      router.replace('/reader');
    } catch (e) {
      setHint(
        e instanceof Error && e.message === 'Unsupported file type'
          ? 'That link isn’t a book, PDF, web page or text file.'
          : 'Could not download that. Check the address and your connection.'
      );
    } finally {
      setBusy(null);
    }
  };

  const canImport = isUrl(url) && !busy;

  return (
    <KeyboardAvoidingView
      style={[styles.screen, { paddingTop: insets.top + 8, paddingBottom: insets.bottom + 16 }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <Pressable
        style={styles.body}
        onPress={Platform.OS === 'web' ? undefined : Keyboard.dismiss}
        accessible={false}
      >
        <View style={styles.header}>
          <Text style={styles.title} accessibilityRole="header">Import URL</Text>
          <Pressable accessibilityRole="button" accessibilityLabel="Close" onPress={() => router.back()} style={styles.corner} hitSlop={8}>
            <CloseIcon color={colors.textPrimary} />
          </Pressable>
        </View>

        <View style={styles.field}>
          <TextInput
            style={styles.input}
            value={url}
            onChangeText={setUrl}
            onSubmitEditing={() => canImport && importUrl()}
            autoFocus
            editable={!busy}
            placeholder="https://example.com/book.epub"
            placeholderTextColor={colors.textTertiary}
            accessibilityLabel="Web address"
            keyboardType="url"
            autoCapitalize="none"
            autoCorrect={false}
            returnKeyType="go"
            keyboardAppearance="dark"
            selectionColor={colors.textPrimary}
          />
        </View>
        <Text style={styles.hint}>An EPUB, a PDF, a text file or a web page.</Text>

        <View style={styles.status} accessibilityLiveRegion="polite">
          {busy ? (
            <View style={styles.busy}>
              <ActivityIndicator color={colors.textSecondary} />
              <Text style={styles.busyText}>{busy}</Text>
            </View>
          ) : (
            hint && <Text style={styles.hint}>{hint}</Text>
          )}
        </View>

        <View style={styles.actions}>
          <Pressable
            accessibilityRole="button"
            onPress={paste}
            disabled={!!busy}
            style={({ pressed }) => [styles.pasteBtn, pressed && styles.pressed, !!busy && styles.disabled]}
          >
            <Text style={styles.pasteText}>Paste</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ disabled: !canImport }}
            onPress={importUrl}
            disabled={!canImport}
            style={({ pressed }) => [styles.importBtn, pressed && styles.pressed, !canImport && styles.disabled]}
          >
            <ArrowRightIcon color={colors.btnPrimaryFg} />
            <Text style={styles.importText}>Import</Text>
          </Pressable>
        </View>
      </Pressable>

      <TextExtractor ref={extractorRef} />
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bgScreen, paddingHorizontal: 16 },
  body: { flex: 1 },
  header: { height: 56, alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
  title: { fontSize: 18, fontWeight: '600', color: colors.textPrimary },
  corner: {
    position: 'absolute',
    right: 0,
    minWidth: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.btnSecondaryBg,
    boxShadow: shadows.small,
    alignItems: 'center',
    justifyContent: 'center',
  },
  field: {
    height: 56,
    paddingHorizontal: 18,
    justifyContent: 'center',
    backgroundColor: colors.bgCard,
    borderWidth: 1,
    borderColor: colors.divider,
    borderRadius: 20,
    boxShadow: shadows.regular,
  },
  input: { padding: 0, color: colors.textPrimary, fontSize: 16 },
  hint: { marginTop: 10, fontSize: 13, color: colors.textTertiary, textAlign: 'center' },
  // Takes the space between the field and the buttons, so the buttons sit at the bottom.
  status: { flex: 1, alignItems: 'center' },
  busy: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 24 },
  busyText: { fontSize: 13, color: colors.textTertiary },
  actions: { flexDirection: 'row', gap: 12, marginTop: 16 },
  pasteBtn: {
    height: 56,
    paddingHorizontal: 24,
    borderRadius: 28,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.btnSecondaryBg,
    boxShadow: shadows.small,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pasteText: { fontSize: 17, fontWeight: '600', color: colors.btnSecondaryFg },
  importBtn: {
    flex: 1,
    height: 56,
    borderRadius: 28,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.btnPrimaryBg,
    boxShadow: shadows.regular,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  importText: { fontSize: 18, fontWeight: '600', color: colors.btnPrimaryFg },
  pressed: { transform: [{ scale: 0.97 }] },
  disabled: { opacity: 0.5 },
});
