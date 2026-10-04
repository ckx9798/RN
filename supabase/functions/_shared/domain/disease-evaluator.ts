// 질환 관련 영양정보와 규칙 평가 (설계 11장, 12.1).
//
// - 질환 선택만으로 섭취 가능 여부를 판정하지 않는다.
// - 근거·검수가 없는 규칙(active=false, reviewedAt=null, evidenceUrl=null,
//   threshold=null)은 절대 실행하지 않는다.
// - 단위가 일치하지 않는 규칙도 실행하지 않는다.

import { COPY, fillTemplate, NUTRIENT_NAMES } from "./copy.ts";
import type { DiseaseRule, DiseaseStandard, Finding, Nutrients, UserProfileSnapshot } from "./types.ts";

function isRuleExecutable(rule: DiseaseRule): boolean {
  return rule.active && rule.reviewedAt !== null && rule.evidenceUrl !== null && rule.threshold !== null;
}

function ruleTriggers(rule: DiseaseRule, value: number): boolean {
  if (rule.threshold === null) return false;
  switch (rule.operator) {
    case "gt":
      return value > rule.threshold;
    case "gte":
      return value >= rule.threshold;
    case "lt":
      return value < rule.threshold;
    case "lte":
      return value <= rule.threshold;
  }
}

type Input = {
  profile: UserProfileSnapshot;
  diseases: DiseaseStandard[];
  rules: DiseaseRule[];
  nutrients: Nutrients | null;
};

export function evaluateDiseases(input: Input): Finding[] {
  const { profile, diseases, rules, nutrients } = input;

  if (profile.hasNoKnownDisease) return [];

  const byId = new Map(diseases.map((d) => [d.id, d]));
  const findings: Finding[] = [];

  for (const diseaseId of profile.diseaseIds) {
    const disease = byId.get(diseaseId);
    if (!disease) continue;

    // DIS-001("질환 없음")처럼 배타적 선택 상태는 애초에 다른 질환과
    // 함께 선택되지 않아야 하고(설계 9.2), hasNoKnownDisease로 이미
    // 걸러진다. 그래도 diseaseIds에 들어온 경우를 대비해 명시적으로
    // 건너뛴다 — finding을 만들지 않는다(M2).
    if (disease.analysisSupport === "exclusive") continue;

    if (disease.analysisSupport === "unsupported") {
      findings.push({
        category: "disease_nutrition",
        severity: "needs_review",
        standardId: disease.id,
        title: `${disease.name} ${COPY.unsupportedTitleSuffix}`,
        description: COPY.diseaseUnsupportedDescription,
        matchedText: null,
        source: "user_profile",
        evidenceUrl: null,
      });
      continue;
    }

    if (disease.analysisSupport === "memo_only") {
      findings.push({
        category: "disease_nutrition",
        severity: "needs_review",
        standardId: disease.id,
        title: `${disease.name} ${COPY.memoOnlyTitleSuffix}`,
        description: COPY.diseaseMemoOnlyDescription,
        matchedText: null,
        source: "user_profile",
        evidenceUrl: null,
      });
      continue;
    }

    // nutrition_candidate 또는 limited
    if (disease.relatedNutrients.length === 0) {
      // limited인데 관련 영양정보 기준이 아직 없음
      findings.push({
        category: "disease_nutrition",
        severity: "needs_review",
        standardId: disease.id,
        title: `${disease.name} ${COPY.needsReviewTitleSuffix}`,
        description: COPY.diseaseLimitedNoNutrientsDescription,
        matchedText: null,
        source: "user_profile",
        evidenceUrl: null,
      });
      continue;
    }

    if (nutrients === null) {
      findings.push({
        category: "disease_nutrition",
        severity: "needs_review",
        standardId: disease.id,
        title: `${disease.name} ${COPY.needsReviewTitleSuffix}`,
        description: COPY.diseaseMissingNutrientsDescription,
        matchedText: null,
        source: "user_profile",
        evidenceUrl: null,
      });
      continue;
    }

    const diseaseRules = rules.filter((r) => r.diseaseId === disease.id);

    let handled = false;
    for (const nutrientKey of disease.relatedNutrients) {
      const nutrient = nutrients[nutrientKey];
      if (!nutrient) continue;

      const applicableRules = diseaseRules.filter((r) => r.targetKey === nutrientKey);
      const executableRules = applicableRules.filter(isRuleExecutable);
      // 단위가 일치하는 규칙만 실제로 평가한다. 단위가 다른 규칙이
      // 섞여 있다고 해서 단위가 맞는 규칙의 평가 결과를 지우지 않는다
      // (M1) — 대신 별도의 확인 필요 finding을 "함께" 추가한다.
      const matchingUnitRules = executableRules.filter((r) => r.unit === nutrient.unit);
      const mismatchedUnitRules = executableRules.filter((r) => r.unit !== nutrient.unit);

      const triggered = matchingUnitRules.find((r) => ruleTriggers(r, nutrient.value));

      if (triggered) {
        findings.push({
          category: "disease_nutrition",
          severity: triggered.severity,
          standardId: disease.id,
          title: `${disease.name} ${
            triggered.severity === "caution" ? COPY.cautionTitleSuffix : COPY.needsReviewTitleSuffix
          }`,
          description: triggered.message,
          matchedText: null,
          source: "rule",
          evidenceUrl: triggered.evidenceUrl,
        });
      } else {
        // 실행 가능한(단위가 맞는) 규칙이 없거나 발동하지 않음 -> 값만 안내
        findings.push({
          category: "disease_nutrition",
          severity: "info",
          standardId: disease.id,
          title: `${disease.name} ${COPY.nutrientInfoTitleSuffix}`,
          description: fillTemplate(COPY.diseaseNutrientInfoDescriptionTemplate, {
            nutrient: NUTRIENT_NAMES[nutrientKey],
            value: String(nutrient.value),
            unit: nutrient.unit,
          }),
          matchedText: null,
          source: "mfds_api",
          evidenceUrl: null,
        });
      }

      if (mismatchedUnitRules.length > 0) {
        findings.push({
          category: "disease_nutrition",
          severity: "needs_review",
          standardId: disease.id,
          title: `${disease.name} ${COPY.needsReviewTitleSuffix}`,
          description: COPY.diseaseUnitMismatchDescription,
          matchedText: null,
          source: "user_profile",
          evidenceUrl: null,
        });
      }

      handled = true;
    }

    if (!handled) {
      // 관련 영양값이 하나도 없음
      findings.push({
        category: "disease_nutrition",
        severity: "needs_review",
        standardId: disease.id,
        title: `${disease.name} ${COPY.needsReviewTitleSuffix}`,
        description: COPY.diseaseMissingNutrientsDescription,
        matchedText: null,
        source: "user_profile",
        evidenceUrl: null,
      });
    }
  }

  return findings;
}
