import {
  MAX_BRIDGE_MESSAGE_BYTES,
  MAX_BRIDGE_REQUEST_BYTES,
  REQUEST_ID_PATTERN,
  type NativeToWebMessage,
  type ScanRequestV1,
} from '@/shared/config/bridge-contract';

const FORBIDDEN_PATTERNS = [
  /data:[a-z]+\/[a-z0-9.+-]+;base64,/i,
  /(file|content|ph|assets-library):\/\//i,
  /[A-Za-z0-9+/=]{500,}/,
  /eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\./,
];

export function containsForbiddenContent(value: string): boolean {
  return FORBIDDEN_PATTERNS.some((pattern) => pattern.test(value));
}

/** 문자열의 UTF-8 바이트 길이를 계산한다 (TextEncoder에 의존하지 않는다). */
function byteLength(value: string): number {
  let bytes = 0;
  for (let i = 0; i < value.length; i += 1) {
    const code = value.codePointAt(i)!;
    if (code > 0xffff) {
      i += 1; // 서로게이트 쌍
    }
    if (code <= 0x7f) {
      bytes += 1;
    } else if (code <= 0x7ff) {
      bytes += 2;
    } else if (code <= 0xffff) {
      bytes += 3;
    } else {
      bytes += 4;
    }
  }
  return bytes;
}

export type ParseWebMessageResult =
  | { ok: true; message: ScanRequestV1 }
  | {
      ok: false;
      reason:
        | 'too_large'
        | 'invalid_json'
        | 'unsupported_version'
        | 'unknown_type'
        | 'invalid_shape'
        | 'duplicate_request';
    };

const ALLOWED_KEYS = new Set(['version', 'type', 'requestId']);

export function parseWebMessage(raw: string, seenRequestIds: Set<string>): ParseWebMessageResult {
  if (byteLength(raw) > MAX_BRIDGE_REQUEST_BYTES) {
    return { ok: false, reason: 'too_large' };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { ok: false, reason: 'invalid_json' };
  }

  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    return { ok: false, reason: 'invalid_shape' };
  }

  const record = parsed as Record<string, unknown>;
  const keys = Object.keys(record);
  const hasOnlyAllowedKeys = keys.length === ALLOWED_KEYS.size && keys.every((key) => ALLOWED_KEYS.has(key));
  if (!hasOnlyAllowedKeys) {
    return { ok: false, reason: 'invalid_shape' };
  }

  if (record.version !== 1) {
    return { ok: false, reason: 'unsupported_version' };
  }

  if (record.type !== 'SCAN_REQUEST') {
    return { ok: false, reason: 'unknown_type' };
  }

  if (typeof record.requestId !== 'string' || !REQUEST_ID_PATTERN.test(record.requestId)) {
    return { ok: false, reason: 'invalid_shape' };
  }

  if (seenRequestIds.has(record.requestId)) {
    return { ok: false, reason: 'duplicate_request' };
  }

  return { ok: true, message: { version: 1, type: 'SCAN_REQUEST', requestId: record.requestId } };
}

/** 네이티브->웹 메시지의 크기·금지 내용 제약을 검사하고, 위반 시 throw한다. */
export function assertOutgoingMessage(msg: NativeToWebMessage): NativeToWebMessage {
  const serialized = JSON.stringify(msg);

  if (byteLength(serialized) > MAX_BRIDGE_MESSAGE_BYTES) {
    throw new Error('bridge message exceeds MAX_BRIDGE_MESSAGE_BYTES');
  }

  if (containsForbiddenContent(serialized)) {
    throw new Error('bridge message contains forbidden content');
  }

  return msg;
}
