import { assertEquals } from "@std/assert";
import { buildAllergenFindings, decideStatus } from "../_shared/domain/decide-status.ts";
import type { AllergenMatch, AllergenStandard, DataQuality, Finding, UserProfileSnapshot } from "../_shared/domain/types.ts";

const STANDARDS: AllergenStandard[] = [
  { id: "FOOD-006", name: "밀", sourceUrl: "https://example.com/food-006" },
  { id: "FOOD-002", name: "우유", sourceUrl: "https://example.com/food-002" },
  { id: "FOOD-004", name: "땅콩", sourceUrl: "https://example.com/food-004" },
];

function profile(allergenIds: string[]): UserProfileSnapshot {
  return { allergenIds, diseaseIds: [], hasNoKnownDisease: false, consentVersion: "v1" };
}

const COMPLETE_QUALITY: DataQuality = {
  ocrReviewed: true,
  productMatch: "matched",
  nutritionAvailable: true,
  apiStatus: "ok",
  conflicts: [],
  missing: [],
  sourceDate: "2026-09-01",
};

Deno.test("buildAllergenFindings: 등록하지 않은 알레르기는 finding을 만들지 않는다", () => {
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
  ];
  const findings = buildAllergenFindings(matches, profile(["FOOD-002"]), STANDARDS);
  assertEquals(findings, []);
});

Deno.test("buildAllergenFindings: confirmed direct는 caution/allergen, 기준명 포함 제목", () => {
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
  ];
  const findings = buildAllergenFindings(matches, profile(["FOOD-006"]), STANDARDS);
  assertEquals(findings.length, 1);
  assertEquals(findings[0].severity, "caution");
  assertEquals(findings[0].category, "allergen");
  assertEquals(findings[0].title, "밀 포함");
  assertEquals(findings[0].evidenceUrl, "https://example.com/food-006");
  assertEquals(findings[0].matchedText, "밀가루");
  assertEquals(findings[0].standardId, "FOOD-006");
});

Deno.test("buildAllergenFindings: cross는 caution/cross_contamination, 교차혼입 가능 제목", () => {
  const matches: AllergenMatch[] = [
    {
      allergenId: "FOOD-004",
      term: "땅콩",
      matchedText: "땅콩",
      kind: "cross_contamination",
      source: "label",
      matchType: "statement",
      confidence: "confirmed",
    },
  ];
  const findings = buildAllergenFindings(matches, profile(["FOOD-004"]), STANDARDS);
  assertEquals(findings.length, 1);
  assertEquals(findings[0].severity, "caution");
  assertEquals(findings[0].category, "cross_contamination");
  assertEquals(findings[0].title, "땅콩 교차혼입 가능");
});

Deno.test("buildAllergenFindings: possible만 있으면 needs_review, 확인 필요 제목", () => {
  const matches: AllergenMatch[] = [
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
  const findings = buildAllergenFindings(matches, profile(["FOOD-002"]), STANDARDS);
  assertEquals(findings.length, 1);
  assertEquals(findings[0].severity, "needs_review");
  assertEquals(findings[0].title, "우유 확인 필요");
});

Deno.test("decideStatus: caution 1건 + needs_review 1건 -> caution", () => {
  const findings: Finding[] = [
    {
      category: "allergen",
      severity: "caution",
      standardId: "FOOD-006",
      title: "밀 포함",
      description: "",
      matchedText: "밀가루",
      source: "label",
      evidenceUrl: null,
    },
    {
      category: "data_quality",
      severity: "needs_review",
      standardId: null,
      title: "확인 필요",
      description: "",
      matchedText: null,
      source: "label",
      evidenceUrl: null,
    },
  ];
  assertEquals(decideStatus(findings, COMPLETE_QUALITY), "caution");
});

Deno.test("decideStatus: needs_review만 -> needs_review", () => {
  const findings: Finding[] = [
    {
      category: "data_quality",
      severity: "needs_review",
      standardId: null,
      title: "확인 필요",
      description: "",
      matchedText: null,
      source: "label",
      evidenceUrl: null,
    },
  ];
  assertEquals(decideStatus(findings, COMPLETE_QUALITY), "needs_review");
});

Deno.test("decideStatus: info만 + quality 완전 -> no_flags", () => {
  const findings: Finding[] = [
    {
      category: "disease_nutrition",
      severity: "info",
      standardId: "DIS-002",
      title: "나트륨 정보",
      description: "",
      matchedText: null,
      source: "mfds_api",
      evidenceUrl: null,
    },
  ];
  assertEquals(decideStatus(findings, COMPLETE_QUALITY), "no_flags");
});

Deno.test("decideStatus: findings 없어도 quality 불완전하면 needs_review", () => {
  assertEquals(decideStatus([], { ...COMPLETE_QUALITY, ocrReviewed: false }), "needs_review");
  assertEquals(decideStatus([], { ...COMPLETE_QUALITY, productMatch: "ambiguous" }), "needs_review");
  assertEquals(decideStatus([], { ...COMPLETE_QUALITY, productMatch: "not_found" }), "needs_review");
  assertEquals(decideStatus([], { ...COMPLETE_QUALITY, productMatch: "unavailable" }), "needs_review");
  assertEquals(decideStatus([], { ...COMPLETE_QUALITY, conflicts: ["OCR/API 불일치"] }), "needs_review");
  assertEquals(decideStatus([], { ...COMPLETE_QUALITY, missing: ["영양정보 없음"] }), "needs_review");
});

Deno.test("decideStatus: findings 없고 quality 완전하면 no_flags", () => {
  assertEquals(decideStatus([], COMPLETE_QUALITY), "no_flags");
});
