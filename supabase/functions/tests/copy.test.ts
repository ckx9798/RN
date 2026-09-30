import { assertEquals } from "@std/assert";
import { COPY, FORBIDDEN_WORDS, RULE_SET_VERSION } from "../_shared/domain/copy.ts";
import { buildAllergenFindings, decideStatus } from "../_shared/domain/decide-status.ts";
import { evaluateDiseases } from "../_shared/domain/disease-evaluator.ts";
import type { AllergenMatch, AllergenStandard, DiseaseStandard, UserProfileSnapshot } from "../_shared/domain/types.ts";

Deno.test("COPY.noFlagsNotice는 지정된 문구와 정확히 같다", () => {
  assertEquals(
    COPY.noFlagsNotice,
    "현재 확인 가능한 정보에서 주의 항목을 찾지 못했어요. 실제 제품 표시를 다시 확인해 주세요.",
  );
});

Deno.test("RULE_SET_VERSION은 지정된 값이다", () => {
  assertEquals(RULE_SET_VERSION, "2026-09-30.1");
});

function containsForbiddenWord(text: string): string | null {
  for (const word of FORBIDDEN_WORDS) {
    if (text.includes(word)) return word;
  }
  return null;
}

Deno.test("COPY의 모든 문자열에 금지어가 없다", () => {
  for (const [key, value] of Object.entries(COPY)) {
    if (typeof value !== "string") continue;
    const hit = containsForbiddenWord(value);
    if (hit) throw new Error(`COPY.${key}에 금지어 "${hit}" 포함`);
  }
});

Deno.test("알레르기 finding 제목·설명에 금지어가 없다(샘플)", () => {
  const standards: AllergenStandard[] = [
    { id: "FOOD-006", name: "밀", sourceUrl: "https://example.com" },
    { id: "FOOD-004", name: "땅콩", sourceUrl: "https://example.com" },
    { id: "FOOD-002", name: "우유", sourceUrl: "https://example.com" },
  ];
  const profile: UserProfileSnapshot = {
    allergenIds: ["FOOD-006", "FOOD-004", "FOOD-002"],
    diseaseIds: [],
    hasNoKnownDisease: false,
    consentVersion: "v1",
  };
  const matches: AllergenMatch[] = [
    {
      allergenId: "FOOD-006",
      term: "밀가루",
      matchedText: "밀가루",
      kind: "direct",
      source: "label",
      matchType: "phrase",
      confidence: "confirmed",
    },
    {
      allergenId: "FOOD-004",
      term: "땅콩",
      matchedText: "땅콩",
      kind: "cross_contamination",
      source: "label",
      matchType: "statement",
      confidence: "confirmed",
    },
    {
      allergenId: "FOOD-002",
      term: "크림",
      matchedText: "크림",
      kind: "direct",
      source: "label",
      matchType: "exact_token",
      confidence: "possible",
    },
  ];
  const findings = buildAllergenFindings(matches, profile, standards);
  assertEquals(findings.length, 3);
  for (const f of findings) {
    const titleHit = containsForbiddenWord(f.title);
    const descHit = containsForbiddenWord(f.description);
    if (titleHit) throw new Error(`title에 금지어 "${titleHit}": ${f.title}`);
    if (descHit) throw new Error(`description에 금지어 "${descHit}": ${f.description}`);
  }
});

Deno.test("질환 finding 제목·설명에 금지어가 없다(샘플)", () => {
  const diseases: DiseaseStandard[] = [
    { id: "DIS-002", name: "고혈압", analysisSupport: "nutrition_candidate", relatedNutrients: ["sodium"] },
    { id: "DIS-006", name: "알레르기 비염", analysisSupport: "unsupported", relatedNutrients: [] },
    { id: "DIS-028", name: "기타", analysisSupport: "memo_only", relatedNutrients: [] },
  ];
  const profile: UserProfileSnapshot = {
    allergenIds: [],
    diseaseIds: ["DIS-002", "DIS-006", "DIS-028"],
    hasNoKnownDisease: false,
    consentVersion: "v1",
  };
  const findings = evaluateDiseases({
    profile,
    diseases,
    rules: [],
    nutrients: { sodium: { value: 300, unit: "mg" } },
  });
  for (const f of findings) {
    const titleHit = containsForbiddenWord(f.title);
    const descHit = containsForbiddenWord(f.description);
    if (titleHit) throw new Error(`title에 금지어 "${titleHit}": ${f.title}`);
    if (descHit) throw new Error(`description에 금지어 "${descHit}": ${f.description}`);
  }
});

Deno.test("decideStatus 관련 상수는 순환 임포트 없이 사용 가능하다", () => {
  assertEquals(typeof decideStatus, "function");
});
