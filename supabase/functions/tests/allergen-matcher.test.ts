import { assertEquals, assertExists } from "@std/assert";
import { matchAllergens } from "../_shared/domain/allergen-matcher.ts";
import { ALLERGEN_TERMS } from "./fixtures/reference-data.ts";
import type { AllergenMatch } from "../_shared/domain/types.ts";

function ids(matches: AllergenMatch[]): string[] {
  return [...new Set(matches.map((m) => m.allergenId))].sort();
}

function match(
  ingredientsText: string | null,
  allergenStatement: string | null = null,
  crossContaminationStatement: string | null = null,
) {
  return matchAllergens(
    { ingredientsText, allergenStatement, crossContaminationStatement, source: "label" },
    ALLERGEN_TERMS,
  );
}

Deno.test("1. 단순 원재료 phrase 직접 매칭", () => {
  const matches = match("밀가루, 설탕");
  assertEquals(ids(matches), ["FOOD-006"]);
  assertEquals(matches[0].confidence, "confirmed");
  assertEquals(matches[0].kind, "direct");
});

Deno.test("2. 부정 합성어: 메밀가루는 밀 오탐 없음", () => {
  const matches = match("메밀가루, 정제소금");
  assertEquals(ids(matches), ["FOOD-003"]);
});

Deno.test("3. 땅콩버터는 FOOD-004만, 버터(exact_token)는 불일치", () => {
  const matches = match("땅콩버터");
  assertEquals(ids(matches), ["FOOD-004"]);
});

Deno.test("4. 게맛살향은 불일치, 게·새우는 매칭", () => {
  assertEquals(ids(match("게맛살향")), []);
  assertEquals(ids(match("게, 새우")), ["FOOD-009", "FOOD-010"]);
});

Deno.test("5. 강낭콩·완두는 콩 오탐 없음, 콩(국산)은 매칭", () => {
  assertEquals(ids(match("강낭콩, 완두")), []);
  assertEquals(ids(match("콩(국산)")), ["FOOD-005"]);
});

Deno.test("6. 복합원재료 내부 별칭 매칭", () => {
  const matches = match("혼합제제[대두레시틴(대두)]");
  assertEquals(ids(matches), ["FOOD-005"]);
});

Deno.test("7. 영문 대소문자 무시", () => {
  assertEquals(ids(match("Shrimp Extract")), ["FOOD-010"]);
});

Deno.test("8. 식물성크림은 불일치, 크림 단독은 possible", () => {
  assertEquals(ids(match("식물성크림")), []);
  const matches = match("크림");
  assertEquals(ids(matches), ["FOOD-002"]);
  assertEquals(matches[0].confidence, "possible");
});

Deno.test("9. allergenStatement: label_context 용어는 문장에서만 매칭, 조사 허용", () => {
  const matches = match(null, "알류, 우유, 조개류(굴) 함유");
  assertEquals(ids(matches), ["FOOD-001", "FOOD-002", "FOOD-013"]);
  for (const m of matches) {
    assertEquals(m.matchType, "statement");
    assertEquals(m.confidence, "confirmed");
    assertEquals(m.kind, "direct");
  }

  const withParticle = match(null, "우유를 사용");
  assertEquals(ids(withParticle), ["FOOD-002"]);
});

Deno.test("10. crossContaminationStatement 매칭", () => {
  const matches = match(null, null, "이 제품은 땅콩, 게를 사용한 제품과 같은 제조시설에서 제조");
  assertEquals(ids(matches), ["FOOD-004", "FOOD-009"]);
  for (const m of matches) {
    assertEquals(m.kind, "cross_contamination");
  }
});

Deno.test("11. 원재료 본문에 label_context 용어만 있으면 매칭하지 않는다", () => {
  assertEquals(ids(match("알류")), []);
  assertEquals(ids(match("조개류")), []);
});

Deno.test("12. 아황산류 관련 별칭 매칭", () => {
  assertEquals(ids(match("이산화황")), ["FOOD-019"]);
  assertEquals(ids(match("메타중아황산칼륨")), ["FOOD-019"]);
  assertEquals(ids(match("Sulfur Dioxide")), ["FOOD-019"]);
});

Deno.test("13. 모든 시드 별칭이 각각 매칭된다", () => {
  for (const term of ALLERGEN_TERMS) {
    const matches = term.matchType === "label_context"
      ? match(null, `${term.term} 함유`)
      : match(term.term);
    const found = matches.some((m) => m.allergenId === term.allergenId);
    if (!found) {
      throw new Error(
        `term "${term.term}" (${term.allergenId}, ${term.matchType})가 매칭되지 않음`,
      );
    }
  }
});

Deno.test("14. source가 입력대로 전달된다", () => {
  const matches = matchAllergens(
    { ingredientsText: "밀가루", allergenStatement: null, crossContaminationStatement: null, source: "mfds_api" },
    ALLERGEN_TERMS,
  );
  assertExists(matches[0]);
  assertEquals(matches[0].source, "mfds_api");
});

Deno.test("동일 allergenId·kind·source는 confirmed 우선 1건으로 합쳐진다", () => {
  // 버터(exact_token confirmed)와 크림(exact_token possible)이 둘 다 있는 경우도
  // 서로 다른 allergenId 없이 같은 FOOD-002로 모인다.
  const matches = match("버터, 크림");
  const milk = matches.filter((m) => m.allergenId === "FOOD-002");
  assertEquals(milk.length, 1);
  assertEquals(milk[0].confidence, "confirmed");
});
