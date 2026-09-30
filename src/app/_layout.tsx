import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import { useColorScheme } from 'react-native';

import { cleanupStaleImages } from '@/features/food-ocr';
import { ScanSessionProvider } from '@/features/native-bridge';

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const colorScheme = useColorScheme();

  useEffect(() => {
    SplashScreen.hideAsync();
    // 앱이 비정상 종료된 뒤 남을 수 있는 카메라·이미지 매니퓰레이터 캐시의
    // 이전 실행 임시 이미지를 정리한다(설계 7.3).
    cleanupStaleImages();
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
