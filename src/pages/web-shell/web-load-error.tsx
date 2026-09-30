import { Pressable, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Spacing } from '@/shared/config/theme';
import { useTheme } from '@/shared/lib/use-theme';
import { ThemedText } from '@/shared/ui/themed-text';
import { ThemedView } from '@/shared/ui/themed-view';

export function WebLoadError({ onRetry }: { onRetry: () => void }) {
  const theme = useTheme();

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <ThemedText type="title" style={styles.title}>
          연결할 수 없어요
        </ThemedText>
        <ThemedText type="small" themeColor="textSecondary" style={styles.description}>
          앱 서버에 연결하지 못했어요. 네트워크 상태를 확인한 뒤 다시 시도해 주세요.
        </ThemedText>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="다시 시도"
          onPress={onRetry}
          style={[styles.button, { backgroundColor: theme.backgroundElement }]}
        >
          <ThemedText type="smallBold">다시 시도</ThemedText>
        </Pressable>
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
    gap: Spacing.three,
  },
  title: {
    textAlign: 'center',
  },
  description: {
    textAlign: 'center',
  },
  button: {
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.two,
    borderRadius: Spacing.two,
  },
});
