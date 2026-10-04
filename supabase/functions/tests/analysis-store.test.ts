import { createClient } from "@supabase/supabase-js";
import { assert, assertEquals, assertFalse, assertRejects } from "@std/assert";
import { createAnalysisStore } from "../_shared/analysis/analysis-store.ts";
import { runAnalysis } from "../_shared/analysis/run-analysis.ts";
import { analysisDeps, profile, scan } from "./fixtures/analysis.ts";

type Call = {
  table: string;
  method: string;
  body: Record<string, unknown> | Record<string, unknown>[] | null;
  url: URL;
};
function storeHarness(rows: Record<string, unknown> = {}, failing = "") {
  const calls: Call[] = [];
  const client = createClient("https://db.example", "anon-key", {
    auth: { persistSession: false, autoRefreshToken: false },
    global: {
      headers: { Authorization: "Bearer user-token" },
      fetch: (input, init) => {
        const url = new URL(String(input));
        const table = url.pathname.split("/").at(-1)!;
        const method = init?.method ?? "GET";
        assertEquals(
          new Headers(init?.headers).get("authorization"),
          "Bearer user-token",
        );
        calls.push({
          table,
          method,
          body: init?.body ? JSON.parse(String(init.body)) : null,
          url,
        });
        if (table === failing) {
          return Promise.resolve(
            Response.json({ message: "PRIVATE database error" }, {
              status: 500,
            }),
          );
        }
        if (method === "POST" && table === "save_my_analysis") {
          return Promise.resolve(Response.json("saved-id"));
        }
        return Promise.resolve(
          method === "GET"
            ? Response.json(rows[table] ?? [])
            : new Response(null, { status: 204 }),
        );
      },
    },
  });
  return { store: createAnalysisStore(client), calls };
}
Deno.test("store: absent profile stays null, DB failure must not become absent", async () => {
  assertEquals(await storeHarness().store.loadProfile(), null);
  await assertRejects(
    () => storeHarness({}, "profiles").store.loadProfile(),
    Error,
    "analysis_store_failed",
  );
});
Deno.test("store: profile snapshot uses RLS owned selections and ignores notes", async () => {
  const { store } = storeHarness({
    profiles: { consent_version: "v1", has_no_known_disease: false },
    user_allergens: [{ allergen_id: "FOOD-006" }],
    user_diseases: [{ disease_id: "DIS-002", note: "private memo" }],
  });
  assertEquals(await store.loadProfile(), {
    consentVersion: "v1",
    hasNoKnownDisease: false,
    allergenIds: ["FOOD-006"],
    diseaseIds: ["DIS-002"],
  });
});
Deno.test("store: active reference rows mapped to domain naming and numeric thresholds", async () => {
  const { store, calls } = storeHarness({
    allergen_standards: [{
      id: "FOOD-006",
      name: "밀",
      source_url: "https://source.example",
    }],
    allergen_match_terms: [{
      allergen_id: "FOOD-006",
      term: "밀가루",
      match_type: "phrase",
      confidence: "confirmed",
      priority: 1,
    }],
    disease_standards: [{
      id: "DIS-002",
      name: "고혈압",
      analysis_support: "nutrition_candidate",
      related_nutrients: ["sodium"],
    }],
    disease_rules: [{
      id: 1,
      disease_id: "DIS-002",
      target_key: "sodium",
      operator: "gte",
      threshold: "300",
      unit: "mg",
      severity: "caution",
      message: "표시 확인",
      evidence_url: "https://source.example",
      rule_version: "v1",
      reviewed_at: "2026-09-30",
      active: true,
    }],
  });
  const reference = await store.loadReference();
  assertEquals(
    reference.allergenStandards[0].sourceUrl,
    "https://source.example",
  );
  assertEquals(reference.terms[0].allergenId, "FOOD-006");
  assertEquals(reference.diseases[0].relatedNutrients, ["sodium"]);
  assertEquals(reference.rules[0].threshold, 300);
  assertEquals(calls.length, 4);
  for (const call of calls) {
    assertEquals(call.url.searchParams.get("active"), "eq.true");
  }
});
Deno.test("store: atomic RPC sends immutable snapshots and findings in original order without user_id", async () => {
  const { store, calls } = storeHarness();
  const request = { ...scan(), ingredientsText: "밀가루" };
  const result = await runAnalysis(
    { scan: request },
    analysisDeps({ save: store.save }),
  );
  assert(!("error" in result));
  assertEquals(result.analysisId, "saved-id");
  assertEquals(calls.length, 1);
  assertEquals(calls[0].url.pathname, "/rest/v1/rpc/save_my_analysis");
  assertEquals(calls[0].method, "POST");
  assertEquals(calls[0].body, {
    p_record: {
      result: result.result,
      scan: request,
      profile: profile(),
      productId: "12345678-1234-1234-1234-123456789abc",
    },
  });
  assertFalse(JSON.stringify(calls[0].body).includes("user_id"));
});
Deno.test("store: failed atomic write rejects without separate insert or delete requests", async () => {
  const { store, calls } = storeHarness({}, "save_my_analysis");
  await assertRejects(
    () =>
      runAnalysis(
        { scan: { ...scan(), ingredientsText: "밀가루" } },
        analysisDeps({ save: store.save }),
      ),
    Error,
    "analysis_store_failed",
  );
  assertEquals(calls.length, 1);
  assertEquals(calls[0].url.pathname, "/rest/v1/rpc/save_my_analysis");
});
