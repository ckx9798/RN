import { assertEquals } from "@std/assert";
import { matchAllergens } from "../_shared/domain/allergen-matcher.ts";
import { ALLERGEN_TERMS } from "./fixtures/reference-data.ts";
import { ALLERGEN_REGRESSION_CASES } from "./fixtures/allergen-regression.ts";

const ALL_ALLERGEN_IDS = [...new Set(ALLERGEN_TERMS.map((t) => t.allergenId))];

for (const testCase of ALLERGEN_REGRESSION_CASES) {
  Deno.test(`회귀: ${testCase.name}`, () => {
    const matches = matchAllergens(
      {
        ingredientsText: testCase.ingredientsText,
        allergenStatement: testCase.allergenStatement,
        crossContaminationStatement: testCase.crossContaminationStatement,
        source: "label",
      },
      ALLERGEN_TERMS,
    );

    const direct = new Set(matches.filter((m) => m.kind === "direct").map((m) => m.allergenId));
    const cross = new Set(
      matches.filter((m) => m.kind === "cross_contamination").map((m) => m.allergenId),
    );

    for (const expected of testCase.expectDirect) {
      if (!direct.has(expected)) {
        throw new Error(`${testCase.name}: 직접 매칭 미탐(${expected})`);
      }
    }
    for (const expected of testCase.expectCross) {
      if (!cross.has(expected)) {
        throw new Error(`${testCase.name}: 교차혼입 매칭 미탐(${expected})`);
      }
    }
    for (const absent of testCase.expectAbsent) {
      if (direct.has(absent) || cross.has(absent)) {
        throw new Error(`${testCase.name}: 오탐(${absent})`);
      }
    }
  });
}

Deno.test("회귀 데이터셋: 알레르기 19종이 각각 최소 1개 expectDirect에 등장한다", () => {
  const covered = new Set(ALLERGEN_REGRESSION_CASES.flatMap((c) => c.expectDirect));
  const missing = ALL_ALLERGEN_IDS.filter((id) => !covered.has(id));
  assertEquals(missing, []);
});

Deno.test("회귀 데이터셋: 25개 이상의 사례를 포함한다", () => {
  if (ALLERGEN_REGRESSION_CASES.length < 25) {
    throw new Error(`사례 수 부족: ${ALLERGEN_REGRESSION_CASES.length}`);
  }
});
