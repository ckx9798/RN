import { describe, expect, it, vi } from "vitest";
import { FunctionsFetchError, FunctionsHttpError } from "@supabase/supabase-js";
import type { SupabaseClient } from "@supabase/supabase-js";
import { analyzeFood, searchFoodCandidates } from "./analyze-client";
import type { AnalyzeFoodResponse } from "./types";

function fakeSupabase(invoke: ReturnType<typeof vi.fn>): SupabaseClient {
  return { functions: { invoke } } as unknown as SupabaseClient;
}

function scanPayload() {
  return {
    productName: "테스트 제품",
    manufacturer: null,
    reportNumber: null,
    ingredientsText: "밀가루, 설탕",
    allergenStatement: null,
    crossContaminationStatement: null,
    rawText: "라벨 원문",
    userReviewed: true as const,
  };
}

describe("analyzeFood", () => {
  it("성공하면 ok:true와 응답 데이터를 반환한다", async () => {
    const response: AnalyzeFoodResponse = {
      analysisId: "analysis-1",
      result: {
        status: "no_flags",
        product: null,
        findings: [],
        dataQuality: {
          ocrReviewed: true,
          productMatch: "not_found",
          nutritionAvailable: false,
          apiStatus: "ok",
          conflicts: [],
          missing: [],
          sourceDate: null,
        },
        analyzedAt: "2026-09-30T00:00:00.000Z",
        ruleSetVersion: "2026-09-30.1",
      },
      candidates: [],
    };

    const invoke = vi.fn().mockResolvedValue({ data: response, error: null });
    const supabase = fakeSupabase(invoke);

    const result = await analyzeFood(supabase, { scan: scanPayload() });

    expect(result).toEqual({ ok: true, data: response });
    expect(invoke).toHaveBeenCalledWith(
      "analyze-food",
      expect.objectContaining({ body: { scan: scanPayload() } }),
    );
  });

  it("FunctionsHttpError면 응답 본문의 error.code로 매핑한다", async () => {
    const httpError = new FunctionsHttpError({
      json: () =>
        Promise.resolve({ error: { code: "invalid_request", message: "잘못된 요청" } }),
    });

    const invoke = vi.fn().mockResolvedValue({ data: null, error: httpError });
    const supabase = fakeSupabase(invoke);

    const result = await analyzeFood(supabase, { scan: scanPayload() });

    expect(result).toEqual({ ok: false, code: "invalid_request" });
  });

  it("네트워크 오류(FunctionsFetchError)면 network 코드를 반환한다", async () => {
    const invoke = vi.fn().mockResolvedValue({
      data: null,
      error: new FunctionsFetchError(new TypeError("network down")),
    });
    const supabase = fakeSupabase(invoke);

    const result = await analyzeFood(supabase, { scan: scanPayload() });

    expect(result).toEqual({ ok: false, code: "network" });
  });
});

describe("searchFoodCandidates", () => {
  it("성공하면 candidates 배열을 반환한다", async () => {
    const invoke = vi.fn().mockResolvedValue({
      data: { candidates: [{ id: "1", reportNumber: null, name: "테스트", manufacturer: null, score: 0.9 }] },
      error: null,
    });
    const supabase = fakeSupabase(invoke);

    const result = await searchFoodCandidates(supabase, "테스트", null);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.candidates).toHaveLength(1);
    }
    expect(invoke).toHaveBeenCalledWith(
      "food-data",
      expect.objectContaining({ body: { query: "테스트", manufacturer: null } }),
    );
  });

  it("HTTP 오류면 코드와 함께 ok:false를 반환한다", async () => {
    const httpError = new FunctionsHttpError({
      json: () => Promise.resolve({ error: { code: "rate_limited", message: "너무 많은 요청" } }),
    });
    const invoke = vi.fn().mockResolvedValue({ data: null, error: httpError });
    const supabase = fakeSupabase(invoke);

    const result = await searchFoodCandidates(supabase, "테스트", null);

    expect(result).toEqual({ ok: false, code: "rate_limited" });
  });
});
