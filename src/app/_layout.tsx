import { Tinos_700Bold, useFonts } from '@expo-google-fonts/tinos';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { colors } from '@/constants/theme';
import { ReaderProvider } from '@/context/reader-context';

SplashScreen.preventAutoHideAsync();

// Mounted only once fonts and the saved reader state are loaded.
function HideSplash() {
  useEffect(() => {
    SplashScreen.hideAsync();
  }, []);
  return null;
}

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({ Tinos_700Bold });
  // Fall back to the system serif if the font fails, rather than never starting.
  if (!fontsLoaded && !fontError) return null;

  return (
    <SafeAreaProvider style={{ backgroundColor: colors.bgScreen }}>
      <ReaderProvider>
        <HideSplash />
        <StatusBar style="light" />
        <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.bgScreen } }}>
          <Stack.Screen name="index" />
          <Stack.Screen name="insert" options={{ presentation: 'modal' }} />
          <Stack.Screen name="url" options={{ presentation: 'modal' }} />
          {/* iOS 26 turns on a full-screen back swipe by default. On the reader, horizontal drags
              belong to the speed slider and page turns, so only the edge swipe goes back. The
              native gesture claims the touch before JS sees it, so this can't be toggled per drag. */}
          <Stack.Screen
            name="reader"
            options={{ animation: 'fade', animationDuration: 260, fullScreenGestureEnabled: false }}
          />
        </Stack>
      </ReaderProvider>
    </SafeAreaProvider>
  );
}
