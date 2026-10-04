import { Linking, Pressable, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Spacing } from '@/shared/config/theme';
import { useTheme } from '@/shared/lib/use-theme';
import { ThemedText } from '@/shared/ui/themed-text';
import { ThemedView } from '@/shared/ui/themed-view';

const MIN_TOUCH_TARGET = 44;

type PermissionNoticeProps = {
  canAskAgain: boolean;
  onRequestPermission(): void;
  onClose(): void;
};

/**
 * 카메라 권한이 거부됐을 때 보여준다. 다시 요청할 수 있으면 권한 요청
 * 버튼을, 더 이상 요청할 수 없으면(canAskAgain === false) 설정 앱으로
 * 이동하는 버튼을 보여준다. 닫기를 누르면 상위(ScannerScreen)가
 * SCAN_FAILED(permission_denied)로 세션을 종료한다.
 */
export function PermissionNotice({ canAskAgain, onRequestPermission, onClose }: PermissionNoticeProps) {
  const theme = useTheme();

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <ThemedText type="subtitle" style={styles.title}>
          카메라 권한이 필요해요
        </ThemedText>
        <ThemedText type="small" themeColor="textSecondary" style={styles.description}>
          라벨의 원재료와 알레르기 표시를 읽기 위해 카메라를 사용합니다. 사진은 기기 밖으로 전송되지 않습니다.
        </ThemedText>
        <View style={styles.actions}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={canAskAgain ? '카메라 권한 허용하기' : '설정에서 권한 허용하기'}
            onPress={canAskAgain ? onRequestPermission : () => Linking.openSettings()}
            style={[styles.primaryButton, { backgroundColor: theme.link }]}
          >
            <ThemedText themeColor="background" type="smallBold">
              {canAskAgain ? '권한 허용하기' : '설정으로 이동'}
            </ThemedText>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="닫기"
            onPress={onClose}
            style={[styles.secondaryButton, { backgroundColor: theme.backgroundElement }]}
          >
            <ThemedText type="smallBold">닫기</ThemedText>
          </Pressable>
        </View>
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
  actions: {
    width: '100%',
    gap: Spacing.two,
  },
  primaryButton: {
    minHeight: MIN_TOUCH_TARGET,
    borderRadius: Spacing.two,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.four,
  },
  secondaryButton: {
    minHeight: MIN_TOUCH_TARGET,
    borderRadius: Spacing.two,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.four,
  },
});
