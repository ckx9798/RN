export type NavigationDecision = 'allow' | 'external' | 'block';

/**
 * WebView 탐색 요청을 판정한다.
 * - 같은 origin: allow (WebView 안에서 계속 탐색)
 * - about:blank: allow
 * - 다른 http(s) origin: external (시스템 브라우저로 위임)
 * - 같은 host이지만 허용 origin(https)보다 스킴이 다운그레이드된 http: block
 * - http(s)가 아닌 모든 스킴(javascript:, file:, data:, intent: 등): block
 * - 파싱 불가능한 URL: block
 */
export function decideNavigation(url: string, allowedOrigin: string): NavigationDecision {
  if (url === 'about:blank') {
    return 'allow';
  }

  let parsedUrl: URL;
  let parsedAllowed: URL;
  try {
    parsedUrl = new URL(url);
    parsedAllowed = new URL(allowedOrigin);
  } catch {
    return 'block';
  }

  if (parsedUrl.protocol !== 'http:' && parsedUrl.protocol !== 'https:') {
    return 'block';
  }

  if (parsedUrl.origin === parsedAllowed.origin) {
    return 'allow';
  }

  const isDowngradedScheme =
    parsedUrl.hostname === parsedAllowed.hostname &&
    parsedAllowed.protocol === 'https:' &&
    parsedUrl.protocol === 'http:';
  if (isDowngradedScheme) {
    return 'block';
  }

  return 'external';
}
