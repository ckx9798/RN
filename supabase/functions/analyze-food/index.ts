import {
  type AnalysisDeps,
  runAnalysis,
} from "../_shared/analysis/run-analysis.ts";
import { createPostHandler } from "../_shared/http/post-handler.ts";
import { parseAnalyzeFoodRequest } from "../_shared/http/request-validation.ts";
import { authenticateRuntime } from "../_shared/analysis/runtime.ts";
import { createRateLimiter } from "../_shared/http/rate-limit.ts";
export type AnalyzeHandlerDeps = {
  authenticate(
    req: Request,
  ): Promise<{ userId: string; deps: AnalysisDeps } | null>;
  limiter: { take(key: string): boolean };
  allowedOrigins?: string[];
};
export function createAnalyzeFoodHandler(
  deps: AnalyzeHandlerDeps,
): (req: Request) => Promise<Response> {
  return createPostHandler({
    ...deps,
    parse: parseAnalyzeFoodRequest,
    execute: (input, user) => runAnalysis(input, user.deps),
  });
}

if (import.meta.main) {
  Deno.serve(
    createAnalyzeFoodHandler({
      authenticate: authenticateRuntime,
      limiter: createRateLimiter({ limit: 20, windowMs: 60000 }),
    }),
  );
}
