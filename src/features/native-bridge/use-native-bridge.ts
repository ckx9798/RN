import { router } from 'expo-router';
import { useCallback, useEffect, useRef, type RefObject } from 'react';
import type { WebView, WebViewMessageEvent } from 'react-native-webview';

import { buildInjectionScripts } from './drain-outbox';
import { useScanSession } from './scan-session-context';
import { parseWebMessage } from './validate-message';

function originOf(url: string): string | null {
  try {
    return new URL(url).origin;
  } catch {
    return null;
  }
}

/**
 * WebView<->네이티브 브리지를 연결한다.
 * - 수신: 허용 origin의 메시지만 파싱하고, 유효한 SCAN_REQUEST면 스캔 세션을
 *   시작하고 /scanner로 이동한다.
 * - 발신: 세션 완료로 outbox에 쌓인 메시지를 buildInjectionScripts로 변환해
 *   WebView에 injectJavaScript로 주입한다. 크기·금지 내용 위반으로 변환이
 *   실패한 메시지는 buildInjectionScripts가 SCAN_FAILED(unknown)로 대체하므로
 *   여기서는 크래시 걱정 없이 그대로 주입한다.
 */
export function useNativeBridge(webViewRef: RefObject<WebView | null>, allowedOrigin: string) {
  const { start, outbox, drain } = useScanSession();
  const seenRequestIds = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (outbox.length === 0) {
      return;
    }

    const messages = drain();
    const scripts = buildInjectionScripts(messages);
    for (const script of scripts) {
      webViewRef.current?.injectJavaScript(script);
    }
  }, [outbox, drain, webViewRef]);

  const onMessage = useCallback(
    (event: WebViewMessageEvent) => {
      const eventOrigin = originOf(event.nativeEvent.url);
      if (eventOrigin !== allowedOrigin) {
        return;
      }

      const result = parseWebMessage(event.nativeEvent.data, seenRequestIds.current);
      if (!result.ok) {
        return;
      }

      seenRequestIds.current.add(result.message.requestId);
      start(result.message.requestId);
      router.push({ pathname: '/scanner', params: { requestId: result.message.requestId } });
    },
    [allowedOrigin, start],
  );

  return { onMessage };
}
