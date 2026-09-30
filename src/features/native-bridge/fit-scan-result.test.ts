import { MAX_BRIDGE_MESSAGE_BYTES, type ScanResultV1 } from '@/shared/config/bridge-contract';

import { fitScanResultToLimit } from './fit-scan-result';
import { byteLength } from './validate-message';

function buildMsg(rawText: string): ScanResultV1 {
  return {
    version: 1,
    type: 'SCAN_RESULT',
    requestId: 'abcd1234',
    payload: {
      productName: '테스트 과자',
      manufacturer: '테스트 제조사',
      reportNumber: '12345678',
      ingredientsText: '밀가루, 설탕, 식용유, 소금',
      allergenStatement: '밀, 대두 함유',
      crossContaminationStatement: '땅콩을 사용한 제품과 같은 시설에서 제조',
      rawText,
      userReviewed: true,
    },
  };
}

describe('fitScanResultToLimit', () => {
  it('이미 상한 이하면 그대로 반환한다', () => {
    const msg = buildMsg('짧은 원문');
    expect(fitScanResultToLimit(msg)).toEqual(msg);
  });

  it('64KB를 넘는 한글 rawText를 상한 이하로 자른다', () => {
    // 한글 문자는 UTF-8에서 3바이트이므로 70000자면 넉넉히 상한을 넘는다.
    const msg = buildMsg('가'.repeat(70000));
    expect(byteLength(JSON.stringify(msg))).toBeGreaterThan(MAX_BRIDGE_MESSAGE_BYTES);

    const fitted = fitScanResultToLimit(msg);

    expect(byteLength(JSON.stringify(fitted))).toBeLessThanOrEqual(MAX_BRIDGE_MESSAGE_BYTES);
  });

  it('rawText 외 필드는 그대로 유지한다', () => {
    const msg = buildMsg('나'.repeat(70000));
    const fitted = fitScanResultToLimit(msg);

    expect(fitted.version).toBe(msg.version);
    expect(fitted.type).toBe(msg.type);
    expect(fitted.requestId).toBe(msg.requestId);
    expect(fitted.payload.productName).toBe(msg.payload.productName);
    expect(fitted.payload.manufacturer).toBe(msg.payload.manufacturer);
    expect(fitted.payload.reportNumber).toBe(msg.payload.reportNumber);
    expect(fitted.payload.ingredientsText).toBe(msg.payload.ingredientsText);
    expect(fitted.payload.allergenStatement).toBe(msg.payload.allergenStatement);
    expect(fitted.payload.crossContaminationStatement).toBe(msg.payload.crossContaminationStatement);
    expect(fitted.payload.userReviewed).toBe(true);
  });

  it('잘라낸 rawText는 원문의 접두사다', () => {
    const original = '다'.repeat(70000);
    const msg = buildMsg(original);
    const fitted = fitScanResultToLimit(msg);

    expect(fitted.payload.rawText.length).toBeGreaterThan(0);
    expect(fitted.payload.rawText.length).toBeLessThan(original.length);
    expect(original.startsWith(fitted.payload.rawText)).toBe(true);
  });

  it('잘라낸 결과는 assertOutgoingMessage를 통과할 만큼 작다', () => {
    // fitScanResultToLimit의 목적 자체가 buildInjection/assertOutgoingMessage가
    // 더 이상 크기 초과로 throw하지 않게 만드는 것이므로 회귀로 다시 검증한다.
    const msg = buildMsg('라'.repeat(200000));
    const fitted = fitScanResultToLimit(msg);

    expect(() => JSON.stringify(fitted)).not.toThrow();
    expect(byteLength(JSON.stringify(fitted))).toBeLessThanOrEqual(MAX_BRIDGE_MESSAGE_BYTES);
  });
});
