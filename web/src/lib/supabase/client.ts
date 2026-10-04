import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabasePublishableKey =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!;

/**
 * 브라우저에서 사용할 Supabase 클라이언트를 반환한다. `@supabase/ssr`의
 * `createBrowserClient`는 브라우저 환경에서 기본적으로 싱글턴을
 * 유지하므로 별도의 캐싱 로직이 필요 없다.
 */
export function createBrowserSupabase(): SupabaseClient {
  return createBrowserClient(supabaseUrl, supabasePublishableKey);
}
