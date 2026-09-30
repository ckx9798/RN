import {
  BRIDGE_VERSION,
  MAX_BRIDGE_MESSAGE_BYTES,
  REQUEST_ID_PATTERN,
  type NativeToWebMessage,
  type ScanFailedV1,
  type ScanPayload,
} from "./contract";

// 브리지 보안 규칙(설계 6장): Base64 이미지, 파일 URI, 이어진 Base64 유사
// 문자열, JWT 형태 문자열을 금지한다.
const FORBIDDEN_PATTERNS = [
  /data:[a-z]+\/[a-z0-9.+-]+;base64,/i,
  /(file|content|ph|assets-library):\/\//i,
  /[A-Za-z0-9+/=]{500,}/,
  /eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\./,
];

export function containsForbiddenContent(value: string): boolean {
  return FORBIDDEN_PATTERNS.some((pattern) => pattern.test(value));
}

type ParseFailureReason =
  | "not_string"
  | "too_large"
  | "invalid_json"
  | "unsupported_version"
  | "unknown_type"
  | "invalid_shape"
  | "forbidden_content";

export type ParseNativeMessageResult =
  | { ok: true; message: NativeToWebMessage }
  | { ok: false; reason: ParseFailureReason };

const SUPPORTED_TYPES = ["SCAN_RESULT", "SCAN_CANCELLED", "SCAN_FAILED"] as const;

const SCAN_FAILED_CODES: ScanFailedV1["code"][] = [
  "permission_denied",
  "ocr_failed",
  "invalid_image",
  "unknown",
];

const MAX_PRODUCT_NAME_LENGTH = 200;
const MAX_MANUFACTURER_LENGTH = 200;
const MAX_REPORT_NUMBER_LENGTH = 20;
const MAX_INGREDIENTS_TEXT_LENGTH = 8000;
const MAX_ALLERGEN_STATEMENT_LENGTH = 1000;
const MAX_CROSS_CONTAMINATION_LENGTH = 1000;
const MAX_RAW_TEXT_LENGTH = 20000;
const REPORT_NUMBER_PATTERN = new RegExp(`^\\d{1,${MAX_REPORT_NUMBER_LENGTH}}$`);

const PAYLOAD_KEYS = [
  "productName",
  "manufacturer",
  "reportNumber",
  "ingredientsText",
  "allergenStatement",
  "crossContaminationStatement",
  "rawText",
  "userReviewed",
] as const;

function fail(reason: ParseFailureReason): ParseNativeMessageResult {
  return { ok: false, reason };
}

function hasExactKeys(value: Record<string, unknown>, keys: readonly string[]): boolean {
  const actualKeys = Object.keys(value);
  return actualKeys.length === keys.length && actualKeys.every((key) => keys.includes(key));
}

function isNullableString(value: unknown, maxLength: number): value is string | null {
  if (value === null) {
    return true;
  }
  return typeof value === "string" && value.length <= maxLength;
}

function payloadTextFields(payload: ScanPayload): string[] {
  return [
    payload.productName,
    payload.manufacturer,
    payload.reportNumber,
    payload.ingredientsText,
    payload.allergenStatement,
    payload.crossContaminationStatement,
    payload.rawText,
  ].filter((value): value is string => typeof value === "string");
}

function isValidPayload(value: unknown): value is ScanPayload {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const payload = value as Record<string, unknown>;

  if (!hasExactKeys(payload, PAYLOAD_KEYS)) {
    return false;
  }

  if (!isNullableString(payload.productName, MAX_PRODUCT_NAME_LENGTH)) {
    return false;
  }
  if (!isNullableString(payload.manufacturer, MAX_MANUFACTURER_LENGTH)) {
    return false;
  }
  if (
    payload.reportNumber !== null &&
    !(typeof payload.reportNumber === "string" && REPORT_NUMBER_PATTERN.test(payload.reportNumber))
  ) {
    return false;
  }
  if (
    typeof payload.ingredientsText !== "string" ||
    payload.ingredientsText.length < 1 ||
    payload.ingredientsText.length > MAX_INGREDIENTS_TEXT_LENGTH ||
    payload.ingredientsText.trim().length === 0
  ) {
    return false;
  }
  if (!isNullableString(payload.allergenStatement, MAX_ALLERGEN_STATEMENT_LENGTH)) {
    return false;
  }
  if (!isNullableString(payload.crossContaminationStatement, MAX_CROSS_CONTAMINATION_LENGTH)) {
    return false;
  }
  if (typeof payload.rawText !== "string" || payload.rawText.length > MAX_RAW_TEXT_LENGTH) {
    return false;
  }
  if (payload.userReviewed !== true) {
    return false;
  }

  return true;
}

function isValidRequestId(value: unknown): value is string {
  return typeof value === "string" && REQUEST_ID_PATTERN.test(value);
}

function byteLengthOf(value: string): number {
  if (typeof TextEncoder !== "undefined") {
    return new TextEncoder().encode(value).length;
  }
  return Buffer.byteLength(value, "utf8");
}

export function parseNativeMessage(raw: unknown): ParseNativeMessageResult {
  if (typeof raw !== "string") {
    return fail("not_string");
  }

  if (byteLengthOf(raw) > MAX_BRIDGE_MESSAGE_BYTES) {
    return fail("too_large");
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return fail("invalid_json");
  }

  if (typeof parsed !== "object" || parsed === null) {
    return fail("invalid_shape");
  }

  const candidate = parsed as Record<string, unknown>;

  if (candidate.version !== BRIDGE_VERSION) {
    return fail("unsupported_version");
  }

  if (typeof candidate.type !== "string") {
    return fail("invalid_shape");
  }

  if (!SUPPORTED_TYPES.includes(candidate.type as (typeof SUPPORTED_TYPES)[number])) {
    return fail("unknown_type");
  }

  if (!isValidRequestId(candidate.requestId)) {
    return fail("invalid_shape");
  }

  if (candidate.type === "SCAN_RESULT") {
    if (!hasExactKeys(candidate, ["version", "type", "requestId", "payload"])) {
      return fail("invalid_shape");
    }
    if (!isValidPayload(candidate.payload)) {
      return fail("invalid_shape");
    }
    if (payloadTextFields(candidate.payload).some((text) => containsForbiddenContent(text))) {
      return fail("forbidden_content");
    }
    return {
      ok: true,
      message: {
        version: 1,
        type: "SCAN_RESULT",
        requestId: candidate.requestId,
        payload: candidate.payload,
      },
    };
  }

  if (candidate.type === "SCAN_CANCELLED") {
    if (!hasExactKeys(candidate, ["version", "type", "requestId"])) {
      return fail("invalid_shape");
    }
    return { ok: true, message: { version: 1, type: "SCAN_CANCELLED", requestId: candidate.requestId } };
  }

  // SCAN_FAILED
  if (!hasExactKeys(candidate, ["version", "type", "requestId", "code"])) {
    return fail("invalid_shape");
  }
  if (
    typeof candidate.code !== "string" ||
    !SCAN_FAILED_CODES.includes(candidate.code as ScanFailedV1["code"])
  ) {
    return fail("invalid_shape");
  }

  return {
    ok: true,
    message: {
      version: 1,
      type: "SCAN_FAILED",
      requestId: candidate.requestId,
      code: candidate.code as ScanFailedV1["code"],
    },
  };
}
