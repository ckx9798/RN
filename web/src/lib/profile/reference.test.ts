import { describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { fetchMyProfileSelection } from "./reference";

function client(failingTable?: string) {
  return { from: vi.fn((table: string) => {
    const result = table === failingTable
      ? { data: null, error: { message: "unavailable" } }
      : { data: table === "profiles" ? { consent_version: "v1", has_no_known_disease: false }
        : table === "user_allergens" ? [{ allergen_id: "wheat" }] : [{ disease_id: "diabetes", note: null }], error: null };
    return { select: () => ({ eq: () => table === "profiles" ? { maybeSingle: async () => result } : Promise.resolve(result) }) };
  }) } as unknown as SupabaseClient;
}

describe("fetchMyProfileSelection", () => {
  it.each(["profiles", "user_allergens", "user_diseases"])("%s 조회 실패를 빈 선택으로 바꾸지 않는다", async (table) => {
    await expect(fetchMyProfileSelection(client(table), "user-1")).rejects.toThrow();
  });
  it("모두 조회된 경우에만 편집 가능한 기존 선택을 반환한다", async () => {
    expect(await fetchMyProfileSelection(client(), "user-1")).toEqual({
      hasConsented: true, hasNoKnownDisease: false, allergenIds: ["wheat"], diseases: [{ diseaseId: "diabetes", note: null }],
    });
  });
});
