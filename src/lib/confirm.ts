import { Alert, Platform } from 'react-native';

type ConfirmOptions = { title: string; message: string; confirmText: string; onConfirm: () => void };

// A two-button confirmation: the native alert on iOS/Android, window.confirm on web
// (react-native-web doesn't implement Alert).
export function confirm({ title, message, confirmText, onConfirm }: ConfirmOptions) {
  if (Platform.OS === 'web') {
    if (window.confirm(`${title}\n\n${message}`)) onConfirm();
    return;
  }
  Alert.alert(title, message, [
    { text: 'Cancel', style: 'cancel' },
    { text: confirmText, onPress: onConfirm },
  ]);
}
