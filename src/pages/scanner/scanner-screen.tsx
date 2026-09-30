import { router, useLocalSearchParams, useNavigation } from 'expo-router';
import { useCallback, useEffect, useRef } from 'react';
import { ActivityIndicator, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ScannerCamera, ScannerReview, useFoodOcr, type LabelFields } from '@/features/food-ocr';
import { fitScanResultToLimit, useScanSession } from '@/features/native-bridge';
import type { NativeToWebMessage } from '@/shared/config/bridge-contract';
import { Spacing } from '@/shared/config/theme';
import { ThemedText } from '@/shared/ui/themed-text';
import { ThemedView } from '@/shared/ui/themed-view';

import { decideTerminalMessage } from './decide-terminal-message';

const OCR_ERROR_MESSAGE: Record<'ocr_failed' | 'invalid_image', string> = {
  ocr_failed: 'OCR 인식에 실패했어요. 다시 촬영해 주세요.',
  invalid_image: '이미지를 처리하지 못했어요. 다시 촬영해 주세요.',
};

/**
 * 촬영·온디바이스 OCR·교정 화면(설계 7장, 브리프 N3).
 * requestId가 현재 활성 스캔 세션과 다르면(예: 딥링크로 직접 진입) 즉시
 * 닫는다. 모든 종료 경로 — 전송, 취소 버튼, 권한 거부 닫기, OCR 실패
 * 취소뿐 아니라 하드웨어 뒤로가기·스와이프 제스처·그 밖의 이유로
 * 화면이 예기치 않게 제거되는 경우까지 — 에서 세션을 complete()로
 * 마무리하고 임시 이미지를 releaseAll()로 정리한다. 전송이 아닌 모든
 * 종료는 decideTerminalMessage로 SCAN_CANCELLED 또는 SCAN_FAILED를
 * 고른다.
 */
export function ScannerScreen() {
  const { requestId } = useLocalSearchParams<{ requestId: string }>();
  const { active, complete } = useScanSession();
  const { step, capture, skipProduct, retake, fields, error, reset } = useFoodOcr();
  const navigation = useNavigation();
  const hasFinishedRef = useRef(false);
  // beforeRemove·언마운트 시점에 최신 상태를 읽기 위한 ref. 이 두 리스너는
  // 마운트 시 한 번만 등록하고(아래 finishOnExit는 안정적인 참조) 호출
  // 시점의 최신 값을 ref로 읽는다.
  const errorRef = useRef(error);
  const permissionDeniedRef = useRef(false);

  useEffect(() => {
    errorRef.current = error;
  }, [error]);

  const sessionMatches = !!requestId && active?.requestId === requestId;

  useEffect(() => {
    if (!sessionMatches && !hasFinishedRef.current) {
      hasFinishedRef.current = true;
      router.back();
    }
  }, [sessionMatches]);

  const handlePermissionStatusChange = useCallback((denied: boolean) => {
    permissionDeniedRef.current = denied;
  }, []);

  /**
   * 아직 종료 메시지를 보내지 않은 상태에서 화면이 사라지려 할 때
   * 호출한다. requestId 미스매치로 이미 위 effect가 router.back()을
   * 부르는 경로에서도(hasFinishedRef만 세우고 메시지는 안 보냄) 이
   * 함수가 중복 실행되지 않도록 hasFinishedRef로 막는다. 웹이 무한
   * 대기하지 않도록 반드시 SCAN_CANCELLED나 SCAN_FAILED 중 하나를
   * 보낸다(설계 13장, 코드리뷰 지적사항).
   */
  const finishOnExit = useCallback(() => {
    if (hasFinishedRef.current || !requestId) {
      return;
    }
    hasFinishedRef.current = true;
    const message = decideTerminalMessage(requestId, {
      permissionDenied: permissionDeniedRef.current,
      error: errorRef.current,
    });
    complete(message);
    // 이미지 정리는 화면 제거를 막지 않는다(fire-and-forget). 실패해도
    // 다음 앱 실행의 cleanupStaleImages가 안전망 역할을 한다.
    reset();
  }, [requestId, complete, reset]);

  // 네비게이션이 이 화면을 제거하려는 모든 경우(하드웨어 뒤로가기,
  // iOS 스와이프 제스처, 프로그램에 의한 pop)를 가로챈다. 화면 전환
  // 자체를 막지는 않고(preventDefault 없음) 제거되기 전에 종료 메시지만
  // 반드시 보낸다.
  useEffect(() => {
    const unsubscribe = navigation.addListener('beforeRemove', finishOnExit);
    return unsubscribe;
  }, [navigation, finishOnExit]);

  // 마지막 안전망: beforeRemove가 어떤 이유로든 발생하지 않고 컴포넌트가
  // 언마운트되는 경우에도 종료 메시지를 보낸다. 정상 종료 경로
  // (finishWith)는 router.back() 전에 이미 hasFinishedRef를 세우므로
  // 여기서 중복 실행되지 않는다.
  useEffect(() => {
    return finishOnExit;
  }, [finishOnExit]);

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
    finishWith(decideTerminalMessage(requestId, { permissionDenied: false, error: null }));
  }, [requestId, finishWith]);

  const handlePermissionDenied = useCallback(() => {
    if (!requestId) {
      return;
    }
    finishWith(decideTerminalMessage(requestId, { permissionDenied: true, error: null }));
  }, [requestId, finishWith]);

  const handleErrorCancel = useCallback(() => {
    if (!requestId || !error) {
      return;
    }
    finishWith(decideTerminalMessage(requestId, { permissionDenied: false, error }));
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
      onPermissionStatusChange={handlePermissionStatusChange}
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
