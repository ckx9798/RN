import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef } from 'react';
import { StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useScanSession } from '@/features/native-bridge';
import { Spacing } from '@/shared/config/theme';
import { ThemedText } from '@/shared/ui/themed-text';
import { ThemedView } from '@/shared/ui/themed-view';

/**
 * N3에서 실제 촬영·OCR·교정 화면으로 교체될 자리표시자다.
 * 지금은 요청을 즉시 SCAN_CANCELLED로 완료 처리하고 이전 화면(웹 셸)으로
 * 돌아간다. 실제 촬영 흐름은 Task N3에서 구현한다.
 */
export function ScannerScreen() {
  const { requestId } = useLocalSearchParams<{ requestId: string }>();
  const { complete } = useScanSession();
  const hasCompletedRef = useRef(false);

  useEffect(() => {
    if (hasCompletedRef.current || !requestId) {
      return;
    }
    hasCompletedRef.current = true;
    complete({ version: 1, type: 'SCAN_CANCELLED', requestId });
    router.back();
  }, [requestId, complete]);

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <ThemedText type="small" themeColor="textSecondary">
          촬영 화면을 준비하고 있어요.
        </ThemedText>
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: Spacing.four,
  },
});
