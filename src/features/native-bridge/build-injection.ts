import type { NativeToWebMessage } from '@/shared/config/bridge-contract';

import { assertOutgoingMessage } from './validate-message';

/**
 * 네이티브->웹 메시지를 WebView.injectJavaScript로 전달할 스크립트 문자열로 만든다.
 * `window`의 'message' 이벤트로 dispatch하며, JSON을 두 번 직렬화해 임의의
 * 페이로드 문자열이 스크립트 컨텍스트를 벗어나거나 코드로 실행되지 않게 한다
 * (설계 6장 C1 전달 방식 그대로).
 */
export function buildInjection(msg: NativeToWebMessage): string {
  const validated = assertOutgoingMessage(msg);
  const json = JSON.stringify(validated);

  return `window.dispatchEvent(new MessageEvent('message',{data:${JSON.stringify(json)}}));true;`;
}
