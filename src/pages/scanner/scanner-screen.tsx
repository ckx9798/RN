import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useRef } from 'react';
import { ActivityIndicator, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ScannerCamera, ScannerReview, useFoodOcr, type LabelFields } from '@/features/food-ocr';
import { fitScanResultToLimit, useScanSession } from '@/features/native-bridge';
import type { NativeToWebMessage } from '@/shared/config/bridge-contract';
import { Spacing } from '@/shared/config/theme';
import { ThemedText } from '@/shared/ui/themed-text';
import { ThemedView } from '@/shared/ui/themed-view';

const OCR_ERROR_MESSAGE: Record<'ocr_failed' | 'invalid_image', string> = {
  ocr_failed: 'OCR 인식에 실패했어요. 다시 촬영해 주세요.',
  invalid_image: '이미지를 처리하지 못했어요. 다시 촬영해 주세요.',
};

/**
 * 촬영·온디바이스 OCR·교정 화면(설계 7장, 브리프 N3).
 * requestId가 현재 활성 스캔 세션과 다르면(예: 딥링크로 직접 진입) 즉시
 * 닫는다. 모든 종료 경로(전송·취소·권한 거부·OCR 실패 취소)에서 세션을
 * complete()로 마무리하고 임시 이미지를 releaseAll()로 정리한 뒤
 * router.back()한다.
 */
export function ScannerScreen() {
  const { requestId } = useLocalSearchParams<{ requestId: string }>();
  const { active, complete } = useScanSession();
  const { step, capture, skipProduct, retake, fields, error, reset } = useFoodOcr();
  const hasFinishedRef = useRef(false);

  const sessionMatches = !!requestId && active?.requestId === requestId;

  useEffect(() => {
    if (!sessionMatches && !hasFinishedRef.current) {
      hasFinishedRef.current = true;
      router.back();
    }
  }, [sessionMatches]);

  // 화면을 벗어날 때(뒤로가기 포함) 아직 종료 처리되지 않았다면 임시
  // 이미지를 정리한다. 정상 종료 경로는 finishWith에서 먼저 처리하므로
  // hasFinishedRef가 이미 true라 여기서는 중복 실행되지 않는다.
  useEffect(() => {
    return () => {
      if (!hasFinishedRef.current) {
        reset();
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- 언마운트 시 1회만 실행한다.
  }, []);

  const finishWith = useCallback(
    async (msg: NativeToWebMessage) => {
      if (hasFinishedRef.current) {
        return;
      }
      hasFinishedRef.current = true;
      complete(msg);
      await reset();
      router.back();
    },
    [complete, reset],
  );

  const handleCancel = useCallback(() => {
    if (!requestId) {
      return;
    }
    finishWith({ version: 1, type: 'SCAN_CANCELLED', requestId });
  }, [requestId, finishWith]);

  const handlePermissionDenied = useCallback(() => {
    if (!requestId) {
      return;
    }
    finishWith({ version: 1, type: 'SCAN_FAILED', requestId, code: 'permission_denied' });
  }, [requestId, finishWith]);

  const handleErrorCancel = useCallback(() => {
    if (!requestId || !error) {
      return;
    }
    finishWith({ version: 1, type: 'SCAN_FAILED', requestId, code: error });
  }, [requestId, error, finishWith]);

  const handleSubmit = useCallback(
    (submittedFields: LabelFields) => {
      if (!requestId) {
        return;
      }
      const message = fitScanResultToLimit({
        version: 1,
        type: 'SCAN_RESULT',
        requestId,
        payload: { ...submittedFields, userReviewed: true },
      });
      finishWith(message);
    },
    [requestId, finishWith],
  );

  if (!sessionMatches) {
    return <ThemedView style={styles.container} />;
  }

  if (step === 'processing') {
    return (
      <ThemedView style={styles.container}>
        <SafeAreaView style={styles.centered}>
          <ActivityIndicator size="large" />
          <ThemedText type="small" themeColor="textSecondary" style={styles.processingText}>
            글자를 인식하고 있어요...
          </ThemedText>
        </SafeAreaView>
      </ThemedView>
    );
  }

  if (step === 'review' && fields) {
    return (
      <ScannerReview
        initialFields={fields}
        onSubmit={handleSubmit}
        onRetakeProduct={() => retake('product')}
        onRetakeIngredients={() => retake('ingredients')}
        onCancel={handleCancel}
      />
    );
  }

  const isProductStep = step === 'product';

  return (
    <ScannerCamera
      title={isProductStep ? '제품 정보면을 촬영해 주세요' : '원재료면을 촬영해 주세요'}
      instructions={
        isProductStep
          ? '제품명, 제조사, 품목보고번호가 잘 보이게 촬영해요. 원재료면에서도 확인되면 건너뛸 수 있어요.'
          : '원재료명과 알레르기·교차혼입 표시가 잘 보이게 촬영해요.'
      }
      onCapture={capture}
      onCancel={error ? handleErrorCancel : handleCancel}
      onPermissionDenied={handlePermissionDenied}
      onSkip={isProductStep ? skipProduct : undefined}
      errorMessage={error ? OCR_ERROR_MESSAGE[error] : null}
    />
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: Spacing.two,
  },
  processingText: {
    textAlign: 'center',
  },
});
