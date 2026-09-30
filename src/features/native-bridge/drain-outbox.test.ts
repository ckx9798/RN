import type { ScanCancelledV1, ScanFailedV1, ScanResultV1 } from '@/shared/config/bridge-contract';

import { buildInjectionScripts } from './drain-outbox';

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

  const run = new Function('window', 'MessageEvent', `${script}\nreturn true;`);
  run(fakeWindow, MessageEvent);

  return dispatchedData;
}

describe('buildInjectionScripts', () => {
  it('정상 메시지는 그대로 주입 스크립트로 변환한다', () => {
    const msg: ScanCancelledV1 = { version: 1, type: 'SCAN_CANCELLED', requestId: 'abcd1234' };
    const scripts = buildInjectionScripts([msg]);

    expect(scripts).toHaveLength(1);
    expect(evaluateInjection(scripts[0])).toBe(JSON.stringify(msg));
  });

  it('크기 상한을 넘는 SCAN_RESULT는 버리고 같은 requestId의 SCAN_FAILED(unknown)를 대신 주입한다', () => {
    // 스펙상 유효한 필드 길이 조합이어도 한글은 UTF-8에서 3바이트라 64KB를
    // 넘을 수 있다 — buildInjection이 이 케이스에서 throw하는지가 이 테스트의
    // 전제다.
    const oversized: ScanResultV1 = {
      version: 1,
      type: 'SCAN_RESULT',
      requestId: 'oversized1',
      payload: {
        productName: null,
        manufacturer: null,
        reportNumber: null,
        ingredientsText: '밀가루',
        allergenStatement: null,
        crossContaminationStatement: null,
        rawText: '가'.repeat(70000),
        userReviewed: true,
      },
    };

    const scripts = buildInjectionScripts([oversized]);

    expect(scripts).toHaveLength(1);
    const dispatched = evaluateInjection(scripts[0]);
    const parsed = JSON.parse(dispatched as string) as ScanFailedV1;

    expect(parsed).toEqual({
      version: 1,
      type: 'SCAN_FAILED',
      requestId: 'oversized1',
      code: 'unknown',
    });
  });

  it('금지 내용이 섞인 메시지도 버리고 SCAN_FAILED(unknown)로 대체한다', () => {
    const withForbiddenContent: ScanResultV1 = {
      version: 1,
      type: 'SCAN_RESULT',
      requestId: 'forbidden1',
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

    const scripts = buildInjectionScripts([withForbiddenContent]);
    const dispatched = evaluateInjection(scripts[0]);
    const parsed = JSON.parse(dispatched as string) as ScanFailedV1;

    expect(parsed.type).toBe('SCAN_FAILED');
    expect(parsed.code).toBe('unknown');
    expect(parsed.requestId).toBe('forbidden1');
    // 원인 페이로드(base64 데이터 등)가 대체 메시지에 남아있지 않아야 한다.
    expect(dispatched).not.toContain('base64');
  });

  it('여러 메시지 중 일부만 실패해도 나머지는 정상 주입한다', () => {
    const good: ScanCancelledV1 = { version: 1, type: 'SCAN_CANCELLED', requestId: 'good1234' };
    const bad: ScanResultV1 = {
      version: 1,
      type: 'SCAN_RESULT',
      requestId: 'bad12345',
      payload: {
        productName: null,
        manufacturer: null,
        reportNumber: null,
        ingredientsText: '밀가루',
        allergenStatement: null,
        crossContaminationStatement: null,
        rawText: '나'.repeat(70000),
        userReviewed: true,
      },
    };

    const scripts = buildInjectionScripts([good, bad]);
    expect(scripts).toHaveLength(2);

    expect(evaluateInjection(scripts[0])).toBe(JSON.stringify(good));

    const parsedSecond = JSON.parse(evaluateInjection(scripts[1]) as string) as ScanFailedV1;
    expect(parsedSecond).toEqual({ version: 1, type: 'SCAN_FAILED', requestId: 'bad12345', code: 'unknown' });
  });
});
