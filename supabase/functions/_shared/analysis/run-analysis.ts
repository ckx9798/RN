import type {
  AllergenStandard,
  AllergenTerm,
  AnalysisResult,
  AnalyzeFoodRequest,
  AnalyzeFoodResponse,
  DiseaseRule,
  DiseaseStandard,
  ScanPayload,
  UserProfileSnapshot,
} from "../domain/types.ts";
import type { ProductLookup } from "../data/product-service.ts";
import { matchAllergens } from "../domain/allergen-matcher.ts";
import { NUTRIENT_NAMES, RULE_SET_VERSION } from "../domain/copy.ts";
import {
  buildAllergenFindings,
  decideStatus,
} from "../domain/decide-status.ts";
import { evaluateDiseases } from "../domain/disease-evaluator.ts";
import type { DataQuality, Finding } from "../domain/types.ts";
export type AnalysisDeps = {
  loadReference(): Promise<
    {
      allergenStandards: AllergenStandard[];
      terms: AllergenTerm[];
      diseases: DiseaseStandard[];
      rules: DiseaseRule[];
    }
  >;
  loadProfile(): Promise<UserProfileSnapshot | null>;
  products: {
    lookup(
      scan: ScanPayload,
      selectedProductId: string | null,
    ): Promise<ProductLookup>;
  };
  save(
    record: {
      result: AnalysisResult;
      scan: ScanPayload;
      profile: UserProfileSnapshot;
      productId: string | null;
    },
  ): Promise<string>;
  now(): Date;
};
function qualityFinding(title: string, description: string): Finding {
  return {
    category: "data_quality",
    severity: "needs_review",
    standardId: null,
    title,
    description,
    matchedText: null,
    source: "rule",
    evidenceUrl: null,
  };
}
export async function runAnalysis(
  req: AnalyzeFoodRequest,
  deps: AnalysisDeps,
): Promise<AnalyzeFoodResponse | { error: "profile_required" }> {
  const profile = await deps.loadProfile();
  if (!profile) return { error: "profile_required" };
  const [reference, lookup] = await Promise.all([
    deps.loadReference(),
    deps.products.lookup(req.scan, req.selectedProductId ?? null),
  ]);
  const { product } = lookup;
  const labelMatches = matchAllergens({
    ingredientsText: `${req.scan.ingredientsText}\n${req.scan.rawText}`,
    allergenStatement: req.scan.allergenStatement,
    crossContaminationStatement: req.scan.crossContaminationStatement,
    source: "label",
  }, reference.terms);
  const apiMatches = matchAllergens({
    ingredientsText: product?.ingredientsText ?? null,
    allergenStatement: null,
    crossContaminationStatement: null,
    source: "mfds_api",
  }, reference.terms);
  const conflicts: string[] = [];
  if (req.scan.ingredientsText.trim() && product?.ingredientsText?.trim()) {
    const labelIds = new Set(labelMatches.map((m) => m.allergenId));
    const apiIds = new Set(apiMatches.map((m) => m.allergenId));
    for (const s of reference.allergenStandards) {
      if (labelIds.has(s.id) !== apiIds.has(s.id)) {
        conflicts.push(`${s.name}: 제품 라벨/식약처 API 중 한쪽에서만 확인`);
      }
    }
  }
  const nutritionAvailable = product?.nutrients != null &&
    Object.keys(product.nutrients).length > 0;
  const missing: string[] = [];
  for (const id of profile.allergenIds) {
    if (
      !reference.allergenStandards.some((s) => s.id === id) ||
      !reference.terms.some((t) => t.allergenId === id)
    ) {
      missing.push("선택한 알레르기의 분석 기준을 불러오지 못했어요");
    }
  }
  if (!profile.hasNoKnownDisease) {
    for (const id of profile.diseaseIds) {
      const disease = reference.diseases.find((d) => d.id === id);
      if (!disease) {
        missing.push("선택한 질환의 분석 기준을 불러오지 못했어요");
        continue;
      }
      // Available values remain informational; missing values never imply absence.
      for (const key of disease.relatedNutrients) {
        if (!product?.nutrients?.[key]) {
          missing.push(`${disease.name}: ${NUTRIENT_NAMES[key]} 정보가 없어요`);
        }
      }
    }
  }
  if (lookup.productMatch !== "matched") {
    missing.push("제품 정보를 확정하지 못했어요");
  }
  if (lookup.partialFailure) {
    missing.push("일부 공공 데이터를 조회하지 못했어요");
  }
  if (lookup.apiStatus === "cache") {
    missing.push("공공 데이터를 갱신하지 못해 이전 조회 정보를 사용했어요");
  }
  if (lookup.apiStatus === "error") {
    missing.push("공공 데이터를 조회하지 못했어요");
  }
  if (product && !product.ingredientsText?.trim()) {
    missing.push("공공 원재료 정보가 없어요");
  }
  if (
    !profile.hasNoKnownDisease && profile.diseaseIds.length &&
    !nutritionAvailable
  ) missing.push("질환 관련 영양정보가 없어요");
  const quality: DataQuality = {
    ocrReviewed: req.scan.userReviewed,
    productMatch: lookup.productMatch,
    nutritionAvailable,
    apiStatus: lookup.apiStatus,
    conflicts,
    missing,
    sourceDate: product?.sourceUpdatedAt ?? null,
  };
  const findings = buildAllergenFindings(
    [...labelMatches, ...apiMatches],
    profile,
    reference.allergenStandards,
  );
  if (lookup.productMatch === "ambiguous") {
    findings.push(
      qualityFinding(
        "제품을 선택해 주세요",
        "조회된 후보 중 실제 제품을 선택해 주세요",
      ),
    );
    if (!profile.hasNoKnownDisease && profile.diseaseIds.length) {
      findings.push(
        qualityFinding(
          "질환 관련 정보 확인 필요",
          "제품 선택 후 질환 관련 정보를 확인할 수 있어요",
        ),
      );
    }
  } else {
    findings.push(
      ...evaluateDiseases({
        profile,
        diseases: reference.diseases,
        rules: reference.rules,
        nutrients: product?.nutrients ?? null,
      }),
    );
  }
  for (const conflict of conflicts) {
    findings.push(qualityFinding("원재료 출처 확인 필요", conflict));
  }
  for (const item of missing) {
    findings.push(qualityFinding("데이터 확인 필요", item));
  }
  const result: AnalysisResult = {
    status: decideStatus(findings, quality),
    product,
    findings,
    dataQuality: quality,
    analyzedAt: deps.now().toISOString(),
    ruleSetVersion: RULE_SET_VERSION,
  };
  const analysisId = await deps.save({
    result,
    scan: req.scan,
    profile,
    productId: product?.id ?? null,
  });
  return { analysisId, result, candidates: lookup.candidates };
}
