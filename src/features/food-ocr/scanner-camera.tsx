import { CameraView, useCameraPermissions } from 'expo-camera';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Spacing } from '@/shared/config/theme';
import { useTheme } from '@/shared/lib/use-theme';
import { ThemedText } from '@/shared/ui/themed-text';
import { ThemedView } from '@/shared/ui/themed-view';

import { PermissionNotice } from './permission-notice';

const MIN_TOUCH_TARGET = 44;

type ScannerCameraProps = {
  title: string;
  instructions: string;
  onCapture(uri: string): void;
  onCancel(): void;
  onPermissionDenied(): void;
  onSkip?: () => void;
  /** OCR 실패 등으로 재촬영이 필요할 때 보여줄 안내 문구. */
  errorMessage?: string | null;
  /**
   * 권한 상태가 "거부됨"으로 바뀔 때마다(요청 전 null 상태는 제외) 호출한다.
   * 상위(ScannerScreen)가 하드웨어 뒤로가기·스와이프 제스처 등으로 이
   * 화면이 예기치 않게 닫힐 때도 SCAN_FAILED(permission_denied)를 보낼 수
   * 있도록 현재 권한 상태를 알기 위함이다.
   */
  onPermissionStatusChange?: (denied: boolean) => void;
};

/**
 * 카메라 권한 확인 -> CameraView 미리보기 -> 촬영 흐름을 담당한다.
 * 권한이 없으면 PermissionNotice를 보여주고, 거부 상태로 닫히면
 * onPermissionDenied를 호출한다(SCAN_FAILED permission_denied는 상위에서 처리).
 */
export function ScannerCamera({
  title,
  instructions,
  onCapture,
  onCancel,
  onPermissionDenied,
  onSkip,
  errorMessage,
  onPermissionStatusChange,
}: ScannerCameraProps) {
  const theme = useTheme();
  const cameraRef = useRef<CameraView>(null);
  const [permission, requestPermission] = useCameraPermissions();
  const [isCapturing, setIsCapturing] = useState(false);

  useEffect(() => {
    if (permission && !permission.granted && permission.canAskAgain) {
      requestPermission();
    }
  }, [permission, requestPermission]);

  useEffect(() => {
    onPermissionStatusChange?.(!!permission && !permission.granted);
  }, [permission, onPermissionStatusChange]);

  const handleCapture = useCallback(async () => {
    if (!cameraRef.current || isCapturing) {
      return;
    }
    setIsCapturing(true);
    try {
      const picture = await cameraRef.current.takePictureAsync({ exif: false, quality: 0.9 });
      if (picture?.uri) {
        onCapture(picture.uri);
      }
    } catch {
      // 촬영 자체가 실패하면 사용자가 다시 시도할 수 있게 버튼을 그대로 둔다.
    } finally {
      setIsCapturing(false);
    }
  }, [isCapturing, onCapture]);

  if (!permission) {
    return <ThemedView style={styles.container} />;
  }

  if (!permission.granted) {
    return (
      <PermissionNotice
        canAskAgain={permission.canAskAgain}
        onRequestPermission={requestPermission}
        onClose={onPermissionDenied}
      />
    );
  }

  return (
    <ThemedView style={styles.container}>
      <CameraView ref={cameraRef} style={styles.camera} facing="back" />
      <SafeAreaView style={styles.overlay} pointerEvents="box-none">
        <View style={[styles.textBox, { backgroundColor: theme.backgroundElement }]}>
          <ThemedText type="smallBold">{title}</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            {instructions}
          </ThemedText>
          {errorMessage && (
            <ThemedText type="small" themeColor="text" style={styles.errorText}>
              {errorMessage}
            </ThemedText>
          )}
        </View>

        <View style={styles.controls}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="촬영 취소"
            onPress={onCancel}
            style={[styles.sideButton, { backgroundColor: theme.backgroundElement }]}
          >
            <ThemedText type="smallBold">취소</ThemedText>
          </Pressable>

          <Pressable
            accessibilityRole="button"
            accessibilityLabel="촬영하기"
            onPress={handleCapture}
            disabled={isCapturing}
            style={[styles.captureButton, { backgroundColor: theme.link }]}
          >
            {isCapturing ? (
              <ActivityIndicator color={theme.background} />
            ) : (
              <ThemedText themeColor="background" type="smallBold">
                촬영
              </ThemedText>
            )}
          </Pressable>

          {onSkip ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="이 단계 건너뛰기"
              onPress={onSkip}
              style={[styles.sideButton, { backgroundColor: theme.backgroundElement }]}
            >
              <ThemedText type="smallBold" themeColor="link">
                건너뛰기
              </ThemedText>
            </Pressable>
          ) : (
            <View style={styles.sideButtonPlaceholder} />
          )}
        </View>
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  camera: StyleSheet.absoluteFill,
  overlay: {
    flex: 1,
    justifyContent: 'space-between',
    padding: Spacing.three,
  },
  textBox: {
    borderRadius: Spacing.two,
    padding: Spacing.three,
    gap: Spacing.half,
  },
  errorText: {
    marginTop: Spacing.one,
  },
  controls: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.two,
  },
  sideButton: {
    minHeight: MIN_TOUCH_TARGET,
    minWidth: MIN_TOUCH_TARGET,
    paddingHorizontal: Spacing.three,
    borderRadius: Spacing.two,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sideButtonPlaceholder: {
    minWidth: MIN_TOUCH_TARGET,
  },
  captureButton: {
    minHeight: MIN_TOUCH_TARGET * 1.4,
    minWidth: MIN_TOUCH_TARGET * 1.4,
    borderRadius: (MIN_TOUCH_TARGET * 1.4) / 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
