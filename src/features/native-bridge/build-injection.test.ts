import type { ScanFailedV1, ScanResultV1 } from '@/shared/config/bridge-contract';

import { buildInjection } from './build-injection';

function evaluateInjection(script: string): unknown {
  let dispatchedData: unknown;
  const fakeWindow = {
    dispatchEvent(event: { data: unknown }) {
      dispatchedData = event.data;
    },
  };

  class MessageEvent {
    type: string;
    data: unknown;
    constructor(type: string, init: { data: unknown }) {
      this.type = type;
      this.data = init.data;
    }
  }

  // 실제 WebView와 동일하게 순수 문자열을 new Function으로 평가한다.
  const run = new Function('window', 'MessageEvent', `${script}\nreturn true;`);
  run(fakeWindow, MessageEvent);

  return dispatchedData;
}

describe('buildInjection', () => {
  it('script 종료 태그와 따옴표, 줄바꿈이 섞인 payload도 안전하게 이스케이프한다', () => {
    const msg: ScanResultV1 = {
      version: 1,
      type: 'SCAN_RESULT',
      requestId: 'abcd1234',
      payload: {
        productName: `</script><script>alert('xss')</script>\n"큰따옴표" '작은따옴표'`,
        manufacturer: null,
        reportNumber: null,
        ingredientsText: '밀가루, 설탕',
        allergenStatement: null,
        crossContaminationStatement: null,
        rawText: '줄바꿈\n포함 텍스트',
        userReviewed: true,
      },
    };

    const script = buildInjection(msg);
    const dispatched = evaluateInjection(script);

    expect(dispatched).toBe(JSON.stringify(msg));
    expect(JSON.parse(dispatched as string)).toEqual(msg);
  });

  it('스크립트 실행을 우회할 수 없다 (data는 항상 문자열)', () => {
    const msg: ScanFailedV1 = { version: 1, type: 'SCAN_FAILED', requestId: 'abcd1234', code: 'ocr_failed' };
    const script = buildInjection(msg);
    const dispatched = evaluateInjection(script);

    expect(typeof dispatched).toBe('string');
    expect(script.endsWith('true;')).toBe(true);
  });

  it('빈 문자열이나 위험 문자만 있는 productName도 정상 처리한다', () => {
    const msg: ScanResultV1 = {
      version: 1,
      type: 'SCAN_RESULT',
      requestId: 'abcd1234',
      payload: {
        productName: `\\'"\`\${}</script>`,
        manufacturer: null,
        reportNumber: null,
        ingredientsText: '밀가루',
        allergenStatement: null,
        crossContaminationStatement: null,
        rawText: '',
        userReviewed: true,
      },
    };

    const script = buildInjection(msg);
    const dispatched = evaluateInjection(script);
    expect(dispatched).toBe(JSON.stringify(msg));
  });
});
