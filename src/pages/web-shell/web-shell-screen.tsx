import { useCallback, useEffect, useRef, useState } from 'react';
import { BackHandler, Linking, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { WebView } from 'react-native-webview';
// WebViewErrorEvent/WebViewHttpErrorEvent는 패키지 루트(index.d.ts)에서
// 재수출되지 않아 lib/WebViewTypes를 직접 가져온다 (exports 필드 제한 없음).
import type { WebViewErrorEvent, WebViewHttpErrorEvent } from 'react-native-webview/lib/WebViewTypes';

import { useNativeBridge } from '@/features/native-bridge';
import { decideNavigation, WEBVIEW_ORIGIN_WHITELIST } from '@/features/web-navigation';
import { webAppConfig } from '@/shared/config/app-config';
import { Spacing } from '@/shared/config/theme';
import { ThemedText } from '@/shared/ui/themed-text';
import { ThemedView } from '@/shared/ui/themed-view';

import { WebLoadError } from './web-load-error';

function originOf(url: string): string | null {
  try {
    return new URL(url).origin;
  } catch {
    return null;
  }
}

export function WebShellScreen() {
  if ('error' in webAppConfig) {
    return <WebAppConfigNotice />;
  }

  return <WebShellReady url={webAppConfig.url} origin={webAppConfig.origin} />;
}

function WebShellReady({ url, origin }: { url: string; origin: string }) {
  const webViewRef = useRef<WebView>(null);
  const [loadFailed, setLoadFailed] = useState(false);
  const { onMessage } = useNativeBridge(webViewRef, origin);

  const canGoBackRef = useRef(false);
  useEffect(() => {
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      if (canGoBackRef.current) {
        webViewRef.current?.goBack();
        return true;
      }
      return false;
    });
    return () => subscription.remove();
  }, []);

  const handleShouldStartLoad = useCallback(
    (request: { url: string }) => {
      const decision = decideNavigation(request.url, origin);
      if (decision === 'external') {
        Linking.openURL(request.url).catch(() => {
          // 시스템 브라우저를 열지 못해도 WebView 안에서는 절대 탐색하지 않는다.
        });
        return false;
      }
      return decision === 'allow';
    },
    [origin],
  );

  const handleError = useCallback((_event: WebViewErrorEvent) => {
    // 오류 화면으로 전환되면 WebView가 사라지므로, 더 이상 존재하지 않는
    // 페이지 히스토리로 하드웨어 뒤로가기가 삼켜지지 않게 초기화한다.
    canGoBackRef.current = false;
    setLoadFailed(true);
  }, []);

  const handleHttpError = useCallback(
    (event: WebViewHttpErrorEvent) => {
      const { statusCode, url: errorUrl } = event.nativeEvent;
      if (statusCode >= 500 && originOf(errorUrl) === origin) {
        canGoBackRef.current = false;
        setLoadFailed(true);
      }
    },
    [origin],
  );

  const handleRetry = useCallback(() => {
    setLoadFailed(false);
  }, []);

  if (loadFailed) {
    return <WebLoadError onRetry={handleRetry} />;
  }

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.webViewSafeArea}>
        <WebView
          ref={webViewRef}
          source={{ uri: url }}
          style={styles.webView}
          // 래퍼가 비허용 URL을 Linking으로 먼저 열지 않도록 모든 URL을
          // handleShouldStartLoad의 엄격한 정책으로 전달한다.
          originWhitelist={WEBVIEW_ORIGIN_WHITELIST}
          onShouldStartLoadWithRequest={handleShouldStartLoad}
          setSupportMultipleWindows={false}
          javaScriptCanOpenWindowsAutomatically={false}
          allowFileAccess={false}
          sharedCookiesEnabled
          pullToRefreshEnabled
          onMessage={onMessage}
          onError={handleError}
          onHttpError={handleHttpError}
          onNavigationStateChange={(event) => {
            canGoBackRef.current = event.canGoBack;
          }}
        />
      </SafeAreaView>
    </ThemedView>
  );
}

function WebAppConfigNotice() {
  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <ThemedText type="title" style={styles.title}>
          준비 중이에요
        </ThemedText>
        <ThemedText type="small" themeColor="textSecondary" style={styles.description}>
          웹 앱 주소가 아직 설정되지 않았어요. 설정이 끝나면 이 화면 대신 분석 화면이 표시돼요.
        </ThemedText>
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  webView: {
    flex: 1,
  },
  webViewSafeArea: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: Spacing.four,
    gap: Spacing.two,
  },
  title: {
    textAlign: 'center',
  },
  description: {
    textAlign: 'center',
  },
});
