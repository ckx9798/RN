import { assert, assertEquals, assertRejects } from "@std/assert";
import { runAnalysis } from "../_shared/analysis/run-analysis.ts";
import { RULE_SET_VERSION } from "../_shared/domain/copy.ts";
import {
  ALLERGEN_STANDARDS,
  ALLERGEN_TERMS,
  DISEASE_STANDARDS,
} from "./fixtures/reference-data.ts";
import {
  analysisDeps,
  lookup,
  NOW,
  profile,
  scan,
} from "./fixtures/analysis.ts";

Deno.test("analysis: requires profile before looking up product or saving", async () => {
  const deps = analysisDeps({
    loadProfile: () => Promise.resolve(null),
    products: {
      lookup: () => {
        throw new Error("must not query");
      },
    },
    save: () => {
      throw new Error("must not save");
    },
  });
  assertEquals(await runAnalysis({ scan: scan() }, deps), {
    error: "profile_required",
  });
});
Deno.test("analysis: label allergen caution and immutable inputs saved exactly once", async () => {
  const input = { ...scan(), ingredientsText: "밀가루" };
  const p = profile();
  let count = 0;
  const response = await runAnalysis(
    { scan: input },
    analysisDeps({
      loadProfile: () => Promise.resolve(p),
      save: (record) => {
        count++;
        assertEquals(record.scan, input);
        assertEquals(record.profile, p);
        assertEquals(record.productId, "12345678-1234-1234-1234-123456789abc");
        return Promise.resolve("stored-id");
      },
    }),
  );
  assert(!("error" in response));
  assertEquals(response.result.status, "caution");
  assertEquals(response.analysisId, "stored-id");
  assertEquals(count, 1);
  assertEquals(response.result.analyzedAt, NOW);
  assertEquals(response.result.ruleSetVersion, RULE_SET_VERSION);
});
Deno.test("analysis: ambiguous candidates postpone disease evaluation", async () => {
  const candidates = [{
    id: "candidate",
    name: "과자",
    manufacturer: null,
    reportNumber: null,
    score: 0.5,
  }];
  const response = await runAnalysis(
    { scan: scan() },
    analysisDeps({
      loadProfile: () =>
        Promise.resolve({
          ...profile(),
          hasNoKnownDisease: false,
          diseaseIds: ["DIS-002"],
        }),
      products: {
        lookup: () =>
          Promise.resolve({
            ...lookup(),
            product: null,
            productMatch: "ambiguous",
            candidates,
          }),
      },
    }),
  );
  assert(!("error" in response));
  assertEquals(response.candidates, candidates);
  assertEquals(response.result.status, "needs_review");
  assert(
    response.result.findings.some((f) => f.title === "제품을 선택해 주세요"),
  );
  assertEquals(
    response.result.findings.filter((f) => f.category === "disease_nutrition"),
    [],
  );
  assertEquals(
    response.result.findings.filter((f) =>
      f.description === "제품 선택 후 질환 관련 정보를 확인할 수 있어요"
    ).length,
    1,
  );
});
for (const state of ["not_found", "unavailable"] as const) {
  Deno.test(`analysis: ${state} keeps label allergies and reports missing disease nutrition`, async () => {
    const response = await runAnalysis(
      { scan: { ...scan(), ingredientsText: "우유" } },
      analysisDeps({
        loadProfile: () =>
          Promise.resolve({
            ...profile(),
            hasNoKnownDisease: false,
            diseaseIds: ["DIS-002"],
          }),
        products: {
          lookup: () =>
            Promise.resolve({
              ...lookup(),
              product: null,
              productMatch: state,
            }),
        },
      }),
    );
    assert(!("error" in response));
    assertEquals(response.result.status, "caution");
    assert(
      response.result.findings.some((f) =>
        f.category === "disease_nutrition" && f.severity === "needs_review"
      ),
    );
  });
}
Deno.test("analysis: label and API evidence retained, only registered conflicting allergens recorded", async () => {
  const response = await runAnalysis(
    { scan: { ...scan(), ingredientsText: "밀가루, 땅콩" } },
    analysisDeps({
      products: {
        lookup: () =>
          Promise.resolve({
            ...lookup(),
            product: { ...lookup().product!, ingredientsText: "우유" },
          }),
      },
    }),
  );
  assert(!("error" in response));
  assertEquals(response.result.dataQuality.conflicts, [
    "우유: 제품 라벨/식약처 API 중 한쪽에서만 확인",
    "밀: 제품 라벨/식약처 API 중 한쪽에서만 확인",
  ]);
  assert(
    response.result.findings.some((f) =>
      f.source === "label" && f.standardId === "FOOD-006"
    ),
  );
  assert(
    response.result.findings.some((f) =>
      f.source === "mfds_api" && f.standardId === "FOOD-002"
    ),
  );
});
Deno.test("analysis: label cross-contamination notice is not an API conflict", async () => {
  const response = await runAnalysis(
    {
      scan: {
        ...scan(),
        ingredientsText: "밀가루, 설탕",
        crossContaminationStatement: "땅콩을 사용한 제품과 같은 제조시설에서 제조",
      },
    },
    analysisDeps({
      loadProfile: () =>
        Promise.resolve({ ...profile(), allergenIds: ["FOOD-002"] }),
      products: {
        lookup: () =>
          Promise.resolve({
            ...lookup(),
            product: { ...lookup().product!, ingredientsText: "밀가루, 설탕" },
          }),
      },
    }),
  );
  assert(!("error" in response));
  assertEquals(response.result.dataQuality.conflicts, []);
  assertEquals(response.result.status, "no_flags");
});
Deno.test("analysis: missing reasons are reported once", async () => {
  const response = await runAnalysis(
    { scan: scan() },
    analysisDeps({
      loadProfile: () =>
        Promise.resolve({ ...profile(), allergenIds: ["FOOD-098", "FOOD-099"] }),
    }),
  );
  assert(!("error" in response));
  const missing = response.result.dataQuality.missing;
  assertEquals(missing.length, new Set(missing).size);
  assertEquals(
    response.result.findings.filter((f) => f.title === "데이터 확인 필요")
      .length,
    missing.length,
  );
});
Deno.test("analysis: no_flags only for complete data", async () => {
  const response = await runAnalysis({ scan: scan() }, analysisDeps());
  assert(!("error" in response));
  assertEquals(response.result.status, "no_flags");
  for (
    const patch of [{ partialFailure: true }, { apiStatus: "cache" as const }, {
      product: { ...lookup().product!, ingredientsText: null },
    }]
  ) {
    const partial = await runAnalysis(
      { scan: scan() },
      analysisDeps({
        products: { lookup: () => Promise.resolve({ ...lookup(), ...patch }) },
      }),
    );
    assert(!("error" in partial));
    assertEquals(partial.result.status, "needs_review");
    assert(partial.result.dataQuality.missing.length > 0);
  }
});
Deno.test("analysis: raw text still catches registered label allergen", async () => {
  const response = await runAnalysis({
    scan: { ...scan(), rawText: "우유 함유" },
  }, analysisDeps());
  assert(!("error" in response));
  assertEquals(response.result.status, "caution");
});
Deno.test("analysis: database failure propagated for generic HTTP error", async () => {
  await assertRejects(
    () =>
      runAnalysis(
        { scan: scan() },
        analysisDeps({
          save: () => {
            throw new Error("private DB error");
          },
        }),
      ),
    Error,
  );
});

for (
  const missing of [
    "allergen_standard",
    "allergen_terms",
    "disease_standard",
  ] as const
) {
  Deno.test(`analysis: inactive ${missing} blocks no_flags for selected profile`, async () => {
    const response = await runAnalysis(
      {
        scan: {
          ...scan(),
          ingredientsText: missing === "disease_standard" ? "설탕" : "우유",
        },
      },
      analysisDeps({
        loadProfile: () =>
          Promise.resolve({
            ...profile(),
            hasNoKnownDisease: false,
            diseaseIds: ["DIS-002"],
          }),
        loadReference: () =>
          Promise.resolve({
            allergenStandards: missing === "allergen_standard"
              ? ALLERGEN_STANDARDS.filter((s) => s.id !== "FOOD-002")
              : ALLERGEN_STANDARDS,
            terms: missing === "allergen_terms"
              ? ALLERGEN_TERMS.filter((t) => t.allergenId !== "FOOD-002")
              : ALLERGEN_TERMS,
            diseases: missing === "disease_standard"
              ? DISEASE_STANDARDS.filter((d) => d.id !== "DIS-002")
              : DISEASE_STANDARDS,
            rules: [],
          }),
      }),
    );
    assert(!("error" in response));
    assert(response.result.status !== "no_flags");
    assert(response.result.dataQuality.missing.length > 0);
    assert(
      response.result.findings.some((f) =>
        f.category === "data_quality" && f.severity === "needs_review"
      ),
    );
  });
}
Deno.test("analysis: partial disease nutrient set preserves values but prevents no_flags", async () => {
  const response = await runAnalysis(
    { scan: scan() },
    analysisDeps({
      loadProfile: () =>
        Promise.resolve({
          ...profile(),
          hasNoKnownDisease: false,
          diseaseIds: ["DIS-016"],
        }),
    }),
  );
  assert(!("error" in response));
  assertEquals(response.result.status, "needs_review");
  assert(response.result.dataQuality.missing.some((s) => s.includes("단백질")));
  assert(
    response.result.findings.some((f) =>
      f.category === "disease_nutrition" && f.severity === "info"
    ),
  );
});
