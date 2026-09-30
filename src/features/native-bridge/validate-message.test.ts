import {
  MAX_BRIDGE_MESSAGE_BYTES,
  MAX_BRIDGE_REQUEST_BYTES,
  type ScanCancelledV1,
  type ScanResultV1,
} from '@/shared/config/bridge-contract';

import { assertOutgoingMessage, containsForbiddenContent, parseWebMessage } from './validate-message';

describe('parseWebMessage', () => {
  it('정상 요청을 허용한다', () => {
    const raw = JSON.stringify({ version: 1, type: 'SCAN_REQUEST', requestId: 'abcd1234' });
    const result = parseWebMessage(raw, new Set());

    expect(result).toEqual({
      ok: true,
      message: { version: 1, type: 'SCAN_REQUEST', requestId: 'abcd1234' },
    });
  });

  it('1KB를 초과하면 too_large를 반환한다', () => {
    const raw = JSON.stringify({
      version: 1,
      type: 'SCAN_REQUEST',
      requestId: 'a'.repeat(MAX_BRIDGE_REQUEST_BYTES),
    });
    expect(raw.length).toBeGreaterThan(MAX_BRIDGE_REQUEST_BYTES);

    const result = parseWebMessage(raw, new Set());
    expect(result).toEqual({ ok: false, reason: 'too_large' });
  });

  it('깨진 JSON은 invalid_json을 반환한다', () => {
    const result = parseWebMessage('{not valid json', new Set());
    expect(result).toEqual({ ok: false, reason: 'invalid_json' });
  });

  it('버전이 다르면 unsupported_version을 반환한다', () => {
    const raw = JSON.stringify({ version: 2, type: 'SCAN_REQUEST', requestId: 'abcd1234' });
    const result = parseWebMessage(raw, new Set());
    expect(result).toEqual({ ok: false, reason: 'unsupported_version' });
  });

  it('웹이 보낼 수 없는 타입이면 unknown_type을 반환한다', () => {
    const raw = JSON.stringify({ version: 1, type: 'SCAN_RESULT', requestId: 'abcd1234' });
    const result = parseWebMessage(raw, new Set());
    expect(result).toEqual({ ok: false, reason: 'unknown_type' });
  });

  it('알 수 없는 타입 문자열도 unknown_type을 반환한다', () => {
    const raw = JSON.stringify({ version: 1, type: 'NOT_A_TYPE', requestId: 'abcd1234' });
    const result = parseWebMessage(raw, new Set());
    expect(result).toEqual({ ok: false, reason: 'unknown_type' });
  });

  it('추가 키가 있으면 invalid_shape를 반환한다', () => {
    const raw = JSON.stringify({
      version: 1,
      type: 'SCAN_REQUEST',
      requestId: 'abcd1234',
      extra: 'nope',
    });
    const result = parseWebMessage(raw, new Set());
    expect(result).toEqual({ ok: false, reason: 'invalid_shape' });
  });

  it('requestId 형식이 잘못되면 invalid_shape를 반환한다', () => {
    const raw = JSON.stringify({ version: 1, type: 'SCAN_REQUEST', requestId: 'a b!' });
    const result = parseWebMessage(raw, new Set());
    expect(result).toEqual({ ok: false, reason: 'invalid_shape' });
  });

  it('requestId가 너무 짧으면 invalid_shape를 반환한다', () => {
    const raw = JSON.stringify({ version: 1, type: 'SCAN_REQUEST', requestId: 'short' });
    const result = parseWebMessage(raw, new Set());
    expect(result).toEqual({ ok: false, reason: 'invalid_shape' });
  });

  it('중복 requestId는 duplicate_request를 반환한다', () => {
    const raw = JSON.stringify({ version: 1, type: 'SCAN_REQUEST', requestId: 'abcd1234' });
    const seen = new Set(['abcd1234']);
    const result = parseWebMessage(raw, seen);
    expect(result).toEqual({ ok: false, reason: 'duplicate_request' });
  });

  it('배열이나 null이 최상위면 invalid_shape를 반환한다', () => {
    expect(parseWebMessage('null', new Set())).toEqual({ ok: false, reason: 'invalid_shape' });
    expect(parseWebMessage('[]', new Set())).toEqual({ ok: false, reason: 'invalid_shape' });
  });
});

describe('containsForbiddenContent', () => {
  it('base64 data URI를 탐지한다', () => {
    expect(containsForbiddenContent('내용: data:image/png;base64,iVBORw0KGgoAAAANSU')).toBe(true);
  });

  it('file URI를 탐지한다', () => {
    expect(containsForbiddenContent('사진 경로: file:///storage/emulated/0/img.jpg')).toBe(true);
  });

  it('content URI를 탐지한다', () => {
    expect(containsForbiddenContent('content://media/external/images/1')).toBe(true);
  });

  it('공백 없는 500자 이상의 base64 유사 문자열을 탐지한다', () => {
    expect(containsForbiddenContent('A'.repeat(501))).toBe(true);
  });

  it('JWT 형태를 탐지한다', () => {
    const jwt =
      'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.dozjgNryP4J3jVmNHl0w5N_XgL0n3I9PlFUP0THsR8U';
    expect(containsForbiddenContent(jwt)).toBe(true);
  });

  it('평범한 텍스트는 통과시킨다', () => {
    expect(containsForbiddenContent('과자, 밀가루, 설탕, 식용유를 포함합니다.')).toBe(false);
  });
});

describe('assertOutgoingMessage', () => {
  const baseCancelled: ScanCancelledV1 = { version: 1, type: 'SCAN_CANCELLED', requestId: 'abcd1234' };

  it('정상 메시지는 그대로 반환한다', () => {
    expect(assertOutgoingMessage(baseCancelled)).toBe(baseCancelled);
  });

  it('payload에 base64 data URI가 있으면 throw한다', () => {
    const msg: ScanResultV1 = {
      version: 1,
      type: 'SCAN_RESULT',
      requestId: 'abcd1234',
      payload: {
        productName: null,
        manufacturer: null,
        reportNumber: null,
        ingredientsText: '밀가루',
        allergenStatement: null,
        crossContaminationStatement: null,
        rawText: 'data:image/png;base64,iVBORw0KGgoAAAANSU',
        userReviewed: true,
      },
    };

    expect(() => assertOutgoingMessage(msg)).toThrow();
  });

  it('payload에 file URI가 있으면 throw한다', () => {
    const msg: ScanResultV1 = {
      version: 1,
      type: 'SCAN_RESULT',
      requestId: 'abcd1234',
      payload: {
        productName: 'file:///tmp/a.jpg',
        manufacturer: null,
        reportNumber: null,
        ingredientsText: '밀가루',
        allergenStatement: null,
        crossContaminationStatement: null,
        rawText: '밀가루 100%',
        userReviewed: true,
      },
    };

    expect(() => assertOutgoingMessage(msg)).toThrow();
  });

  it('64KB를 초과하면 throw한다', () => {
    // 한글 문자는 UTF-8에서 3바이트이므로 base64 유사 문자열 탐지 정규식과
    // 충돌하지 않으면서도 손쉽게 64KB(65536바이트)를 넘길 수 있다.
    const msg: ScanResultV1 = {
      version: 1,
      type: 'SCAN_RESULT',
      requestId: 'abcd1234',
      payload: {
        productName: null,
        manufacturer: null,
        reportNumber: null,
        ingredientsText: '가'.repeat(70000),
        allergenStatement: null,
        crossContaminationStatement: null,
        rawText: '',
        userReviewed: true,
      },
    };

    expect(JSON.stringify(msg).length).toBeGreaterThan(MAX_BRIDGE_MESSAGE_BYTES);
    expect(() => assertOutgoingMessage(msg)).toThrow();
  });
});
