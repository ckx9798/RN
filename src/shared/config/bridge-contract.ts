// WebView <-> 네이티브 브리지 메시지 계약 (설계 6장, C1).
// 이 파일의 타입·상수는 웹 앱과 문자 그대로 동일해야 한다.

export const BRIDGE_VERSION = 1;
export const MAX_BRIDGE_MESSAGE_BYTES = 64 * 1024; // 네이티브->웹 결과
export const MAX_BRIDGE_REQUEST_BYTES = 1024; // 웹->네이티브 요청

export type ScanPayload = {
  productName: string | null; // <= 200자
  manufacturer: string | null; // <= 200자
  reportNumber: string | null; // 숫자만, <= 20자
  ingredientsText: string; // 1..8000자, 공백만이면 무효
  allergenStatement: string | null; // <= 1000자
  crossContaminationStatement: string | null; // <= 1000자
  rawText: string; // <= 20000자
  userReviewed: true;
};

export type ScanRequestV1 = { version: 1; type: 'SCAN_REQUEST'; requestId: string };
export type ScanResultV1 = { version: 1; type: 'SCAN_RESULT'; requestId: string; payload: ScanPayload };
export type ScanCancelledV1 = { version: 1; type: 'SCAN_CANCELLED'; requestId: string };
export type ScanFailedV1 = {
  version: 1;
  type: 'SCAN_FAILED';
  requestId: string;
  code: 'permission_denied' | 'ocr_failed' | 'invalid_image' | 'unknown';
};

export type WebToNativeMessage = ScanRequestV1;
export type NativeToWebMessage = ScanResultV1 | ScanCancelledV1 | ScanFailedV1;

export const REQUEST_ID_PATTERN = /^[A-Za-z0-9-]{8,64}$/;
