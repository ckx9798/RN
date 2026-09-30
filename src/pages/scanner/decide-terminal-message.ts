import type { NativeToWebMessage } from '@/shared/config/bridge-contract';

export type ScannerExitState = {
  /** 카메라 권한이 거부된 채로 화면이 닫히는 중인가. */
  permissionDenied: boolean;
  /** OCR/이미지 준비 실패로 재촬영 대기 중이던 오류가 있었는가. */
  error: 'ocr_failed' | 'invalid_image' | null;
};

/**
 * 스캐너 화면이 SCAN_RESULT를 보내지 못한 채(전송 전) 종료될 때 어떤
 * 종결 메시지를 보내야 하는지 결정한다. 버튼으로 명시적으로 취소하는
 * 경로뿐 아니라, 하드웨어 뒤로가기·스와이프 제스처·언마운트처럼 화면이
 * 예기치 않게 사라지는 모든 경로에서 같은 규칙으로 재사용한다.
 * 우선순위: 권한 거부 > OCR/이미지 오류 > 일반 취소.
 */
export function decideTerminalMessage(requestId: string, state: ScannerExitState): NativeToWebMessage {
  if (state.permissionDenied) {
    return { version: 1, type: 'SCAN_FAILED', requestId, code: 'permission_denied' };
  }
  if (state.error) {
    return { version: 1, type: 'SCAN_FAILED', requestId, code: state.error };
  }
  return { version: 1, type: 'SCAN_CANCELLED', requestId };
}
