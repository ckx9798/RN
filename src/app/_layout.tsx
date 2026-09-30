import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import { useColorScheme } from 'react-native';

import { ScanSessionProvider } from '@/features/native-bridge';

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const colorScheme = useColorScheme();

  useEffect(() => {
    SplashScreen.hideAsync();
  }, []);

  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <ScanSessionProvider>
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="scanner" options={{ presentation: 'fullScreenModal' }} />
        </Stack>
      </ScanSessionProvider>
    </ThemeProvider>
  );
}
