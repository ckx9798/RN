import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabasePublishableKey =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!;

const LOGIN_PATH = "/login";

function isLoginPath(pathname: string): boolean {
  return pathname === LOGIN_PATH || pathname.startsWith(`${LOGIN_PATH}/`);
}

/**
 * 요청마다 Supabase 세션 쿠키를 갱신하고, 인증 상태에 따라
 * 로그인 화면과 그 외 경로 사이를 리다이렉트한다. `web/src/proxy.ts`
 * (Next.js Proxy)에서 호출한다.
 *
 * - 비로그인 사용자가 `/login` 이외의 경로에 접근하면 `/login`으로
 *   리다이렉트한다.
 * - 로그인한 사용자가 `/login`에 접근하면 `/`로 리다이렉트한다.
 *
 * `getSession()` 대신 `getClaims()`를 사용해 서버에서 JWT 서명을
 * 검증한다.
 */
export async function updateSession(
  request: NextRequest,
): Promise<NextResponse> {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(supabaseUrl, supabasePublishableKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => {
          request.cookies.set(name, value);
        });
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) => {
          response.cookies.set(name, value, options);
        });
      },
    },
  });

  const { data, error } = await supabase.auth.getClaims();
  const isAuthenticated = !error && data !== null;

  const { pathname } = request.nextUrl;

  if (!isAuthenticated && !isLoginPath(pathname)) {
    const loginUrl = new URL(LOGIN_PATH, request.url);
    return NextResponse.redirect(loginUrl);
  }

  if (isAuthenticated && isLoginPath(pathname)) {
    return NextResponse.redirect(new URL("/", request.url));
  }

  return response;
}
