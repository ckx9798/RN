import { FunctionsHttpError } from "@supabase/supabase-js";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { AnalyzeFoodRequest, AnalyzeFoodResponse, ApiError, ProductCandidate } from "./types";

type ApiErrorCode = ApiError["error"]["code"];

type AnalyzeFoodResult = { ok: true; data: AnalyzeFoodResponse } | { ok: false; code: ApiErrorCode | "network" };

type SearchFoodCandidatesResult =
  | { ok: true; candidates: ProductCandidate[] }
  | { ok: false; code: string };

/**
 * `functions.invoke`가 돌려준 오류를 C2 계약의 `ApiError` 코드로
 * 변환한다. `FunctionsHttpError`는 Edge Function이 보낸 JSON 본문의
 * `error.code`를 그대로 쓰고, 그 외(네트워크·릴레이 오류)는 `network`로
 * 묶는다.
 */
async function toErrorCode(error: unknown): Promise<ApiErrorCode | "network"> {
  if (error instanceof FunctionsHttpError) {
    try {
      const body = (await error.context.json()) as Partial<ApiError>;
      if (body?.error?.code) {
        return body.error.code;
      }
    } catch {
      // 본문을 JSON으로 읽지 못하면 internal로 처리한다.
    }
    return "internal";
  }

  return "network";
}

export async function analyzeFood(
  supabase: SupabaseClient,
  req: AnalyzeFoodRequest,
): Promise<AnalyzeFoodResult> {
  const { data, error } = await supabase.functions.invoke("analyze-food", { body: req });

  if (error) {
    return { ok: false, code: await toErrorCode(error) };
  }

  return { ok: true, data: data as AnalyzeFoodResponse };
}

export async function searchFoodCandidates(
  supabase: SupabaseClient,
  query: string,
  manufacturer: string | null,
): Promise<SearchFoodCandidatesResult> {
  const { data, error } = await supabase.functions.invoke("food-data", {
    body: { query, manufacturer },
  });

  if (error) {
    return { ok: false, code: await toErrorCode(error) };
  }

  const candidates = (data as { candidates: ProductCandidate[] } | null)?.candidates ?? [];
  return { ok: true, candidates };
}
