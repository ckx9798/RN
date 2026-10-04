import type { NativeToWebMessage, ScanFailedV1 } from '@/shared/config/bridge-contract';

import { buildInjection } from './build-injection';

/**
 * outbox에 쌓인 메시지들을 WebView.injectJavaScript로 주입할 스크립트
 * 목록으로 만든다. buildInjection(assertOutgoingMessage 포함)이 크기·금지
 * 내용 위반으로 throw하면(스펙상 유효한 페이로드도 한글 기준 3바이트/자라
 * 64KB를 넘을 수 있다) 해당 메시지는 버리고, 같은 requestId로
 * SCAN_FAILED(unknown)를 대신 주입해 웹이 대기 상태에서 빠져나오게 한다.
 * 원인 페이로드 내용은 어디에도 로그로 남기지 않는다.
 */
export function buildInjectionScripts(messages: NativeToWebMessage[]): string[] {
  const scripts: string[] = [];

  for (const msg of messages) {
    try {
      scripts.push(buildInjection(msg));
      continue;
    } catch {
      // 아래에서 SCAN_FAILED 대체 메시지를 시도한다.
    }

    try {
      const fallback: ScanFailedV1 = { version: 1, type: 'SCAN_FAILED', requestId: msg.requestId, code: 'unknown' };
      scripts.push(buildInjection(fallback));
    } catch {
      // SCAN_FAILED 대체 메시지조차 만들 수 없는 경우(이론상 발생하지 않음)는
      // 이 메시지를 조용히 버린다 — 앱을 크래시시키는 것보다 낫다.
    }
  }

  return scripts;
}
