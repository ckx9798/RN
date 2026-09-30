// 설계 문서 6장(WebView 브리지)과 작업 브리프 C1 계약을 그대로 옮긴다.
// 네이티브 쪽(Expo 앱)의 같은 계약과 항상 함께 갱신해야 한다.

export const BRIDGE_VERSION = 1;
export const MAX_BRIDGE_MESSAGE_BYTES = 64 * 1024; // 네이티브→웹 결과
export const MAX_BRIDGE_REQUEST_BYTES = 1024; // 웹→네이티브 요청

// `requestId`는 이 패턴을 만족해야 한다.
export const REQUEST_ID_PATTERN = /^[A-Za-z0-9-]{8,64}$/;

export type ScanPayload = {
  productName: string | null; // ≤ 200자
  manufacturer: string | null; // ≤ 200자
  reportNumber: string | null; // 숫자만, ≤ 20자
  ingredientsText: string; // 1..8000자, 공백만이면 무효
  allergenStatement: string | null; // ≤ 1000자
  crossContaminationStatement: string | null; // ≤ 1000자
  rawText: string; // ≤ 20000자
  userReviewed: true;
};

export type ScanRequestV1 = { version: 1; type: "SCAN_REQUEST"; requestId: string };

export type ScanResultV1 = {
  version: 1;
  type: "SCAN_RESULT";
  requestId: string;
  payload: ScanPayload;
};

export type ScanCancelledV1 = { version: 1; type: "SCAN_CANCELLED"; requestId: string };

export type ScanFailedV1 = {
  version: 1;
  type: "SCAN_FAILED";
  requestId: string;
  code: "permission_denied" | "ocr_failed" | "invalid_image" | "unknown";
};

export type WebToNativeMessage = ScanRequestV1;
export type NativeToWebMessage = ScanResultV1 | ScanCancelledV1 | ScanFailedV1;
