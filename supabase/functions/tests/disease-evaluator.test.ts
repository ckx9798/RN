import { assertEquals } from "@std/assert";
import { evaluateDiseases } from "../_shared/domain/disease-evaluator.ts";
import type { DiseaseRule, DiseaseStandard, Nutrients, UserProfileSnapshot } from "../_shared/domain/types.ts";

const HYPERTENSION: DiseaseStandard = {
  id: "DIS-002",
  name: "고혈압",
  analysisSupport: "nutrition_candidate",
  relatedNutrients: ["sodium"],
};

const RHINITIS: DiseaseStandard = {
  id: "DIS-006",
  name: "알레르기 비염",
  analysisSupport: "unsupported",
  relatedNutrients: [],
};

const OTHER: DiseaseStandard = {
  id: "DIS-028",
  name: "기타",
  analysisSupport: "memo_only",
  relatedNutrients: [],
};

const KIDNEY: DiseaseStandard = {
  id: "DIS-016",
  name: "신장질환·신부전",
  analysisSupport: "limited",
  relatedNutrients: ["sodium", "protein", "potassium", "phosphorus"],
};

const THYROID_NO_NUTRIENTS: DiseaseStandard = {
  id: "DIS-005",
  name: "갑상선 질환",
  analysisSupport: "limited",
  relatedNutrients: [],
};

const NO_KNOWN_DISEASE: DiseaseStandard = {
  id: "DIS-001",
  name: "질환 없음",
  analysisSupport: "exclusive",
  relatedNutrients: [],
};

function baseProfile(diseaseIds: string[]): UserProfileSnapshot {
  return { allergenIds: [], diseaseIds, hasNoKnownDisease: false, consentVersion: "v1" };
}

const ACTIVE_SODIUM_RULE: DiseaseRule = {
  id: 1,
  diseaseId: "DIS-002",
  targetKey: "sodium",
  operator: "gt",
  threshold: 600,
  unit: "mg",
  severity: "caution",
  message: "나트륨 함량이 높아요",
  evidenceUrl: "https://example.com/evidence",
  ruleVersion: "2026-09-30.1",
  reviewedAt: "2026-09-01T00:00:00Z",
  active: true,
};

Deno.test("hasNoKnownDisease면 빈 배열", () => {
  const findings = evaluateDiseases({
    profile: { allergenIds: [], diseaseIds: [], hasNoKnownDisease: true, consentVersion: "v1" },
    diseases: [HYPERTENSION],
    rules: [],
    nutrients: { sodium: { value: 800, unit: "mg" } },
  });
  assertEquals(findings, []);
});

Deno.test("unsupported 질환은 needs_review, user_profile 출처", () => {
  const findings = evaluateDiseases({
    profile: baseProfile(["DIS-006"]),
    diseases: [RHINITIS],
    rules: [],
    nutrients: null,
  });
  assertEquals(findings.length, 1);
  assertEquals(findings[0].category, "disease_nutrition");
  assertEquals(findings[0].severity, "needs_review");
  assertEquals(findings[0].source, "user_profile");
  assertEquals(findings[0].title.includes("알레르기 비염"), true);
});

Deno.test("memo_only 질환은 needs_review", () => {
  const findings = evaluateDiseases({
    profile: baseProfile(["DIS-028"]),
    diseases: [OTHER],
    rules: [],
    nutrients: null,
  });
  assertEquals(findings.length, 1);
  assertEquals(findings[0].severity, "needs_review");
  assertEquals(findings[0].source, "user_profile");
});

Deno.test("nutrition_candidate인데 영양정보 null이면 needs_review", () => {
  const findings = evaluateDiseases({
    profile: baseProfile(["DIS-002"]),
    diseases: [HYPERTENSION],
    rules: [],
    nutrients: null,
  });
  assertEquals(findings.length, 1);
  assertEquals(findings[0].severity, "needs_review");
});

Deno.test("관련 영양값 있고 활성 규칙 없으면 info finding", () => {
  const findings = evaluateDiseases({
    profile: baseProfile(["DIS-002"]),
    diseases: [HYPERTENSION],
    rules: [],
    nutrients: { sodium: { value: 300, unit: "mg" } },
  });
  assertEquals(findings.length, 1);
  assertEquals(findings[0].severity, "info");
  assertEquals(findings[0].source, "mfds_api");
  assertEquals(findings[0].description.includes("300"), true);
});

Deno.test("비활성 규칙은 실행하지 않는다(info로 대체)", () => {
  const findings = evaluateDiseases({
    profile: baseProfile(["DIS-002"]),
    diseases: [HYPERTENSION],
    rules: [{ ...ACTIVE_SODIUM_RULE, active: false }],
    nutrients: { sodium: { value: 800, unit: "mg" } },
  });
  assertEquals(findings.length, 1);
  assertEquals(findings[0].severity, "info");
});

Deno.test("미검수(reviewedAt null) 규칙은 실행하지 않는다", () => {
  const findings = evaluateDiseases({
    profile: baseProfile(["DIS-002"]),
    diseases: [HYPERTENSION],
    rules: [{ ...ACTIVE_SODIUM_RULE, reviewedAt: null }],
    nutrients: { sodium: { value: 800, unit: "mg" } },
  });
  assertEquals(findings.length, 1);
  assertEquals(findings[0].severity, "info");
});

Deno.test("evidenceUrl 없는 규칙은 실행하지 않는다", () => {
  const findings = evaluateDiseases({
    profile: baseProfile(["DIS-002"]),
    diseases: [HYPERTENSION],
    rules: [{ ...ACTIVE_SODIUM_RULE, evidenceUrl: null }],
    nutrients: { sodium: { value: 800, unit: "mg" } },
  });
  assertEquals(findings.length, 1);
  assertEquals(findings[0].severity, "info");
});

Deno.test("threshold null인 규칙은 실행하지 않는다", () => {
  const findings = evaluateDiseases({
    profile: baseProfile(["DIS-002"]),
    diseases: [HYPERTENSION],
    rules: [{ ...ACTIVE_SODIUM_RULE, threshold: null }],
    nutrients: { sodium: { value: 800, unit: "mg" } },
  });
  assertEquals(findings.length, 1);
  assertEquals(findings[0].severity, "info");
});

Deno.test("활성·검수 규칙이 발동하면 caution, source rule, evidenceUrl 전달", () => {
  const findings = evaluateDiseases({
    profile: baseProfile(["DIS-002"]),
    diseases: [HYPERTENSION],
    rules: [ACTIVE_SODIUM_RULE],
    nutrients: { sodium: { value: 800, unit: "mg" } },
  });
  assertEquals(findings.length, 1);
  assertEquals(findings[0].severity, "caution");
  assertEquals(findings[0].source, "rule");
  assertEquals(findings[0].evidenceUrl, "https://example.com/evidence");
  assertEquals(findings[0].standardId, "DIS-002");
});

Deno.test("규칙이 조건을 만족하지 않으면 발동하지 않고 info로 대체", () => {
  const findings = evaluateDiseases({
    profile: baseProfile(["DIS-002"]),
    diseases: [HYPERTENSION],
    rules: [ACTIVE_SODIUM_RULE],
    nutrients: { sodium: { value: 300, unit: "mg" } },
  });
  assertEquals(findings.length, 1);
  assertEquals(findings[0].severity, "info");
});

Deno.test("단위 불일치 규칙만 있으면 그 규칙은 실행하지 않고(info) 불일치 안내를 함께 낸다(M1)", () => {
  const findings = evaluateDiseases({
    profile: baseProfile(["DIS-002"]),
    diseases: [HYPERTENSION],
    rules: [{ ...ACTIVE_SODIUM_RULE, unit: "g" }],
    nutrients: { sodium: { value: 800, unit: "mg" } },
  });
  // 단위가 맞는 규칙이 없으므로 값 안내(info) + 단위 불일치 안내(needs_review)
  // 두 건이 "함께" 나온다 — 단위 불일치가 결과를 통째로 대체하지 않는다.
  assertEquals(findings.length, 2);
  const severities = findings.map((f) => f.severity).sort();
  assertEquals(severities, ["info", "needs_review"]);
});

Deno.test("단위가 맞는 규칙이 발동해도 단위 불일치 규칙이 섞여 있으면 caution을 지우지 않고 불일치 안내를 함께 낸다(M1)", () => {
  const findings = evaluateDiseases({
    profile: baseProfile(["DIS-002"]),
    diseases: [HYPERTENSION],
    rules: [ACTIVE_SODIUM_RULE, { ...ACTIVE_SODIUM_RULE, id: 2, unit: "g" }],
    nutrients: { sodium: { value: 800, unit: "mg" } },
  });
  assertEquals(findings.length, 2);
  const caution = findings.find((f) => f.severity === "caution");
  const mismatchNotice = findings.find((f) => f.severity === "needs_review");
  assertEquals(caution?.source, "rule");
  assertEquals(mismatchNotice?.source, "user_profile");
});

Deno.test("limited 질환: relatedNutrients 비어있으면 needs_review(일부 지원 안내)", () => {
  const findings = evaluateDiseases({
    profile: baseProfile(["DIS-005"]),
    diseases: [THYROID_NO_NUTRIENTS],
    rules: [],
    nutrients: null,
  });
  assertEquals(findings.length, 1);
  assertEquals(findings[0].severity, "needs_review");
});

Deno.test("limited 질환: relatedNutrients 있으면 nutrition_candidate와 동일 처리", () => {
  const nutrients: Nutrients = { sodium: { value: 500, unit: "mg" } };
  const findings = evaluateDiseases({
    profile: baseProfile(["DIS-016"]),
    diseases: [KIDNEY],
    rules: [],
    nutrients,
  });
  // sodium/protein/potassium/phosphorus 중 값이 있는 sodium만 info로 보고된다.
  assertEquals(findings.length, 1);
  assertEquals(findings[0].severity, "info");
  assertEquals(findings[0].source, "mfds_api");
});

Deno.test("여러 질환을 선택하면 각각 findings를 만든다", () => {
  const findings = evaluateDiseases({
    profile: baseProfile(["DIS-002", "DIS-006"]),
    diseases: [HYPERTENSION, RHINITIS],
    rules: [],
    nutrients: null,
  });
  assertEquals(findings.length, 2);
});

Deno.test("exclusive(DIS-001, 질환 없음)은 diseaseIds에 들어와도 finding을 만들지 않는다(M2)", () => {
  const findings = evaluateDiseases({
    profile: baseProfile(["DIS-001"]),
    diseases: [NO_KNOWN_DISEASE],
    rules: [],
    nutrients: null,
  });
  assertEquals(findings, []);
});

Deno.test("exclusive와 다른 질환이 섞여도 exclusive만 건너뛴다(M2)", () => {
  const findings = evaluateDiseases({
    profile: baseProfile(["DIS-001", "DIS-006"]),
    diseases: [NO_KNOWN_DISEASE, RHINITIS],
    rules: [],
    nutrients: null,
  });
  assertEquals(findings.length, 1);
  assertEquals(findings[0].standardId, "DIS-006");
});

Deno.test("영양정보 안내에는 원문 키가 아니라 한글 영양소명이 들어간다(M4)", () => {
  const findings = evaluateDiseases({
    profile: baseProfile(["DIS-002"]),
    diseases: [HYPERTENSION],
    rules: [],
    nutrients: { sodium: { value: 300, unit: "mg" } },
  });
  assertEquals(findings.length, 1);
  assertEquals(findings[0].description.includes("나트륨"), true);
  assertEquals(findings[0].description.includes("sodium"), false);
});

Deno.test("발동한 규칙의 제목에 COPY 문구를 쓴다(M3, 리터럴 '주의' 하드코딩 아님)", () => {
  const findings = evaluateDiseases({
    profile: baseProfile(["DIS-002"]),
    diseases: [HYPERTENSION],
    rules: [ACTIVE_SODIUM_RULE],
    nutrients: { sodium: { value: 800, unit: "mg" } },
  });
  assertEquals(findings.length, 1);
  assertEquals(findings[0].title, "고혈압 주의");
});
