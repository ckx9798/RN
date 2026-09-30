// 질환 관련 영양정보와 규칙 평가 (설계 11장, 12.1).
//
// - 질환 선택만으로 섭취 가능 여부를 판정하지 않는다.
// - 근거·검수가 없는 규칙(active=false, reviewedAt=null, evidenceUrl=null,
//   threshold=null)은 절대 실행하지 않는다.
// - 단위가 일치하지 않는 규칙도 실행하지 않는다.

import { COPY } from "./copy.ts";
import type { DiseaseRule, DiseaseStandard, Finding, Nutrients, UserProfileSnapshot } from "./types.ts";

function fillTemplate(template: string, vars: Record<string, string>): string {
  return Object.entries(vars).reduce(
    (text, [key, value]) => text.replaceAll(`{${key}}`, value),
    template,
  );
}

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
      const unitMismatch = executableRules.some((r) => r.unit !== nutrient.unit);

      if (unitMismatch) {
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
        handled = true;
        continue;
      }

      const triggered = executableRules.find(
        (r) => r.unit === nutrient.unit && ruleTriggers(r, nutrient.value),
      );

      if (triggered) {
        findings.push({
          category: "disease_nutrition",
          severity: triggered.severity,
          standardId: disease.id,
          title: `${disease.name} ${triggered.severity === "caution" ? "주의" : COPY.needsReviewTitleSuffix}`,
          description: triggered.message,
          matchedText: null,
          source: "rule",
          evidenceUrl: triggered.evidenceUrl,
        });
        handled = true;
        continue;
      }

      // 실행 가능한 규칙이 없거나(비활성·미검수) 발동하지 않음 -> 값만 안내
      findings.push({
        category: "disease_nutrition",
        severity: "info",
        standardId: disease.id,
        title: `${disease.name} ${COPY.nutrientInfoTitleSuffix}`,
        description: fillTemplate(COPY.diseaseNutrientInfoDescriptionTemplate, {
          nutrient: nutrientKey,
          value: String(nutrient.value),
          unit: nutrient.unit,
        }),
        matchedText: null,
        source: "mfds_api",
        evidenceUrl: null,
      });
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
