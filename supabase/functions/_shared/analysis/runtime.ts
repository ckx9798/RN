import { createClient } from "@supabase/supabase-js";
import { createFoodSafetyC002Client } from "../data/foodsafety-c002-client.ts";
import { createMfdsNutritionClient } from "../data/mfds-nutrition-client.ts";
import { createSupabaseProductRepository } from "../data/product-repository.ts";
import { createProductService } from "../data/product-service.ts";
import { requireUser } from "../http/auth.ts";
import { createAnalysisStore } from "./analysis-store.ts";

function requiredEnv(name: string): string {
  const value = Deno.env.get(name);
  if (!value) throw new Error("server_configuration_missing");
  return value;
}

/** Secrets and service-role writes are restricted to public product caches. */
export async function authenticateRuntime(req: Request) {
  const supabaseUrl = requiredEnv("SUPABASE_URL");
  const user = await requireUser(req, {
    supabaseUrl,
    anonKey: requiredEnv("SUPABASE_ANON_KEY"),
  });
  if (!user) return null;
  const cacheClient = createClient(
    supabaseUrl,
    requiredEnv("SUPABASE_SERVICE_ROLE_KEY"),
    {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
    },
  );
  const products = createProductService({
    repo: createSupabaseProductRepository(cacheClient),
    nutrition: createMfdsNutritionClient({
      serviceKey: Deno.env.get("MFDS_DATA_GO_KR_SERVICE_KEY") ?? "",
    }),
    c002: createFoodSafetyC002Client({
      apiKey: Deno.env.get("FOODSAFETY_KOREA_API_KEY") ?? "",
    }),
  });
  const store = createAnalysisStore(user.client, user.userId);
  return {
    userId: user.userId,
    products,
    deps: { ...store, products, now: () => new Date() },
  };
}
