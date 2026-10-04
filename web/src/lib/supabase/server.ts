import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabasePublishableKey =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!;

/**
 * Server Component·Server Action·Route Handler에서 사용할 Supabase
 * 클라이언트를 만든다. 렌더링마다 새로 생성해야 하며 요청 간에
 * 공유하지 않는다.
 *
 * Server Component에서는 쿠키를 쓸 수 없으므로 `setAll`이 실패할 수
 * 있다. 이 경우 세션 갱신은 `session-proxy`(프록시)가 담당하므로
 * 여기서는 조용히 무시한다.
 */
export async function createServerSupabase(): Promise<SupabaseClient> {
  const cookieStore = await cookies();

  return createServerClient(supabaseUrl, supabasePublishableKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options);
          });
        } catch {
          // Server Component에서 호출된 경우 쓰기가 불가능하다.
        }
      },
    },
  });
}
