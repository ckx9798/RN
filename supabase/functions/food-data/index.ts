import type { ProductCandidate } from "../_shared/domain/types.ts";
import { createPostHandler } from "../_shared/http/post-handler.ts";
import { parseFoodDataRequest } from "../_shared/http/request-validation.ts";
import { authenticateRuntime } from "../_shared/analysis/runtime.ts";
import { createRateLimiter } from "../_shared/http/rate-limit.ts";
export type FoodDataHandlerDeps = {
  authenticate(
    req: Request,
  ): Promise<
    {
      userId: string;
      products: {
        search(
          query: string,
          manufacturer: string | null,
        ): Promise<ProductCandidate[]>;
      };
    } | null
  >;
  limiter: { take(key: string): boolean };
  allowedOrigins?: string[];
};
export function createFoodDataHandler(
  deps: FoodDataHandlerDeps,
): (req: Request) => Promise<Response> {
  return createPostHandler({
    ...deps,
    parse: parseFoodDataRequest,
    execute: async (input, user) => ({
      candidates: await user.products.search(input.query, input.manufacturer),
    }),
  });
}

if (import.meta.main) {
  Deno.serve(
    createFoodDataHandler({
      authenticate: authenticateRuntime,
      limiter: createRateLimiter({ limit: 20, windowMs: 60000 }),
    }),
  );
}
