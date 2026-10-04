// WebView가 로드할 웹 앱 URL 설정.
// 프로덕션 빌드는 https만 허용하고, 개발 빌드는 http(로컬 서버)도 허용한다.

export type WebAppConfig = { url: string; origin: string } | { error: 'missing' | 'insecure' | 'invalid' };

export function resolveWebAppConfig(raw: string | undefined, isDev: boolean): WebAppConfig {
  if (!raw || raw.trim().length === 0) {
    return { error: 'missing' };
  }

  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    return { error: 'invalid' };
  }

  if (parsed.protocol !== 'https:' && !(isDev && parsed.protocol === 'http:')) {
    return { error: 'insecure' };
  }

  return { url: raw, origin: parsed.origin };
}

export const webAppConfig: WebAppConfig = resolveWebAppConfig(process.env.EXPO_PUBLIC_WEB_APP_URL, __DEV__);
