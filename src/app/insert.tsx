// Insert Text: type or paste text, then read it.
import * as Clipboard from 'expo-clipboard';
import { router } from 'expo-router';
import { useState } from 'react';
import { Keyboard, KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ArrowRightIcon, CloseIcon } from '@/components/icons';
import { colors, shadows } from '@/constants/theme';
import { useReaderActions } from '@/context/reader-context';
import { useKeyboardVisible } from '@/hooks/use-keyboard-visible';
import { addToLibrary, titleFromText } from '@/lib/library';

export default function InsertTextScreen() {
  const reader = useReaderActions();
  const insets = useSafeAreaInsets();
  const keyboardVisible = useKeyboardVisible();
  const [text, setText] = useState('');
  const [hint, setHint] = useState<string | null>(null);

  const paste = async () => {
    let t = '';
    try { t = await Clipboard.getStringAsync(); } catch { t = ''; }
    if (t.trim()) {
      setText(t);
      setHint(null);
      Keyboard.dismiss();
    } else {
      setHint('Nothing to paste. Copy some text first, or allow pasting when asked.');
    }
  };

  const read = async () => {
    try {
      const item = await addToLibrary({ title: titleFromText(text), text, kind: 'text' });
      if (!item || !reader.loadText(text, item.title, { id: item.id })) return;
      router.replace('/reader');
    } catch {
      setHint('Could not save that text. Your device may be out of space.');
    }
  };

  const canRead = !!text.trim();

  return (
    <KeyboardAvoidingView
      style={[styles.screen, { paddingTop: insets.top + 8, paddingBottom: insets.bottom + 16 }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      {/* Tapping outside the text closes the keyboard. Not on web, where it would blur the
          input on every click into it. */}
      <Pressable
        style={styles.body}
        onPress={Platform.OS === 'web' ? undefined : Keyboard.dismiss}
        accessible={false}
      >
        <View style={styles.header}>
          <Text style={styles.title} accessibilityRole="header">Insert Text</Text>
          {/* Return adds a line, so while typing the corner button closes the keyboard, like Notes. */}
          {keyboardVisible ? (
            <Pressable accessibilityRole="button" onPress={Keyboard.dismiss} style={[styles.corner, styles.done]} hitSlop={8}>
              <Text style={styles.doneText}>Done</Text>
            </Pressable>
          ) : (
            <Pressable accessibilityRole="button" accessibilityLabel="Close" onPress={() => router.back()} style={styles.corner} hitSlop={8}>
              <CloseIcon color={colors.textPrimary} />
            </Pressable>
          )}
        </View>

        <View style={styles.card}>
          <TextInput
            style={styles.input}
            value={text}
            onChangeText={setText}
            multiline
            autoFocus
            textAlignVertical="top"
            placeholder="Paste an article, a chapter, an email. Anything."
            placeholderTextColor={colors.textTertiary}
            accessibilityLabel="Your text"
            keyboardAppearance="dark"
            selectionColor={colors.textPrimary}
          />
        </View>
        {hint && <Text style={styles.hint}>{hint}</Text>}

        <View style={styles.actions}>
          <Pressable accessibilityRole="button" onPress={paste} style={({ pressed }) => [styles.pasteBtn, pressed && styles.pressed]}>
            <Text style={styles.pasteText}>Paste</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ disabled: !canRead }}
            onPress={read}
            disabled={!canRead}
            style={({ pressed }) => [styles.readBtn, pressed && styles.pressed, !canRead && styles.disabled]}
          >
            <ArrowRightIcon color={colors.btnPrimaryFg} />
            <Text style={styles.readText}>Start reading</Text>
          </Pressable>
        </View>
      </Pressable>
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
  done: { paddingHorizontal: 16 },
  doneText: { fontSize: 16, fontWeight: '600', color: colors.textPrimary },
  card: {
    flex: 1,
    backgroundColor: colors.bgCard,
    borderWidth: 1,
    borderColor: colors.divider,
    borderRadius: 20,
    boxShadow: shadows.regular,
    padding: 18,
  },
  input: { flex: 1, padding: 0, color: colors.textPrimary, fontSize: 16, lineHeight: 24 },
  hint: { marginTop: 10, fontSize: 13, color: colors.textTertiary, textAlign: 'center' },
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
  readBtn: {
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
  readText: { fontSize: 18, fontWeight: '600', color: colors.btnPrimaryFg },
  pressed: { transform: [{ scale: 0.97 }] },
  disabled: { opacity: 0.5 },
});
