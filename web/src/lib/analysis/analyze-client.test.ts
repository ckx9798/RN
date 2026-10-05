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
  it("80KiB 초과 한글 요청은 원문 손실 없이 촬영 재시도 오류를 반환한다", async () => {
    const invoke = vi.fn().mockResolvedValue({ data: {}, error: null });
    const scan = { ...scanPayload(), ingredientsText: "가".repeat(2000), rawText: "나".repeat(26000) };
    const original = JSON.stringify(scan);
    expect(await analyzeFood(fakeSupabase(invoke), { scan })).toEqual({ ok: false, code: "payload_too_large" });
    expect(invoke).not.toHaveBeenCalled();
    expect(JSON.stringify(scan)).toBe(original);
  });

  it("후보 선택 UUID를 추가할 공간까지 처음부터 확보한다", async () => {
    const scan = { ...scanPayload(), rawText: "" };
    const base = new TextEncoder().encode(JSON.stringify({ scan })).length;
    scan.rawText = "a".repeat(80 * 1024 - base);
    const invoke = vi.fn().mockResolvedValue({ data: {}, error: null });
    expect(await analyzeFood(fakeSupabase(invoke), { scan })).toEqual({ ok: false, code: "payload_too_large" });
    expect(invoke).not.toHaveBeenCalled();
  });

  it("브리지 최대 크기(64KB)의 한글 scan을 selectedProductId와 함께 감싸도 받아들인다", async () => {
    const response: AnalyzeFoodResponse = {
      analysisId: "analysis-bridge-max",
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
    const selectedProductId = "11111111-1111-1111-1111-111111111111";
    // 브리지 상한(64KB)을 계약 필드 길이(rawText ≤ 20000자) 안에서 채운다.
    const scan = { ...scanPayload(), ingredientsText: "", rawText: "나".repeat(20000) };
    const base = new TextEncoder().encode(JSON.stringify(scan)).length;
    scan.ingredientsText = "가".repeat(Math.floor((64 * 1024 - base) / 3));

    const result = await analyzeFood(fakeSupabase(invoke), { scan, selectedProductId });

    expect(result).toEqual({ ok: true, data: response });
    expect(invoke).toHaveBeenCalledWith(
      "analyze-food",
      expect.objectContaining({ body: { scan, selectedProductId } }),
    );
  });

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
