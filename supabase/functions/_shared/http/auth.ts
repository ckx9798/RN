import { createClient, type SupabaseClient } from "@supabase/supabase-js";
export async function requireUser(
  req: Request,
  deps: { supabaseUrl: string; anonKey: string; fetcher?: typeof fetch },
): Promise<{ userId: string; client: SupabaseClient } | null> {
  const authorization = req.headers.get("authorization");
  const bearer = authorization?.match(/^Bearer ([^\s]+)$/i);
  if (!bearer) return null;
  const client = createClient(deps.supabaseUrl, deps.anonKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
    global: {
      headers: { Authorization: `Bearer ${bearer[1]}` },
      ...(deps.fetcher ? { fetch: deps.fetcher } : {}),
    },
  });
  const { data, error } = await client.auth.getUser(bearer[1]);
  if (error || !data.user) return null;
  return { userId: data.user.id, client };
}
