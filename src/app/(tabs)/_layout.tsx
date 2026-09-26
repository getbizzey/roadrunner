// Bottom tab bar: Library and Explore. Native, so it's Liquid Glass on iOS 26 and Material 3 on Android.
import { NativeTabs } from 'expo-router/unstable-native-tabs';

import { colors } from '@/constants/theme';

export default function TabsLayout() {
  return (
    <NativeTabs tintColor={colors.textPrimary} iconColor={colors.textTertiary}>
      <NativeTabs.Trigger name="index" contentStyle={{ backgroundColor: colors.bgScreen }}>
        <NativeTabs.Trigger.Icon sf="books.vertical.fill" md="library_books" />
        <NativeTabs.Trigger.Label>Library</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="explore" contentStyle={{ backgroundColor: colors.bgScreen }}>
        <NativeTabs.Trigger.Icon sf="safari" md="explore" />
        <NativeTabs.Trigger.Label>Explore</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}
