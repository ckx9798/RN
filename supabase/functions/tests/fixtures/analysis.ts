import type { AnalysisDeps } from "../../_shared/analysis/run-analysis.ts";
import type { ProductLookup } from "../../_shared/data/product-service.ts";
import type {
  ProductMatch,
  ScanPayload,
  UserProfileSnapshot,
} from "../../_shared/domain/types.ts";
import {
  ALLERGEN_STANDARDS,
  ALLERGEN_TERMS,
  DISEASE_STANDARDS,
} from "./reference-data.ts";

export const NOW = "2026-10-05T00:00:00.000Z";
export function scan(): ScanPayload {
  return {
    productName: "과자",
    manufacturer: "제조사",
    reportNumber: "12345678",
    ingredientsText: "설탕",
    allergenStatement: null,
    crossContaminationStatement: null,
    rawText: "비공개 교정 원문",
    userReviewed: true,
  };
}
export function product(): ProductMatch {
  return {
    id: "12345678-1234-1234-1234-123456789abc",
    reportNumber: "12345678",
    name: "과자",
    manufacturer: "제조사",
    foodType: "과자",
    servingSize: "100g",
    nutrients: { sodium: { value: 100, unit: "mg" } },
    ingredientsText: "설탕",
    sourceUpdatedAt: NOW,
    fetchedAt: NOW,
    matchType: "report_number",
  };
}
export function lookup(): ProductLookup {
  return {
    product: product(),
    candidates: [],
    productMatch: "matched",
    apiStatus: "ok",
    partialFailure: false,
  };
}
export function profile(): UserProfileSnapshot {
  return {
    allergenIds: ["FOOD-002", "FOOD-006"],
    diseaseIds: [],
    hasNoKnownDisease: true,
    consentVersion: "v1",
  };
}
export function analysisDeps(
  overrides: Partial<AnalysisDeps> = {},
): AnalysisDeps {
  return {
    loadReference: () =>
      Promise.resolve({
        allergenStandards: ALLERGEN_STANDARDS,
        terms: ALLERGEN_TERMS,
        diseases: DISEASE_STANDARDS,
        rules: [],
      }),
    loadProfile: () => Promise.resolve(profile()),
    products: { lookup: () => Promise.resolve(lookup()) },
    save: () => Promise.resolve("saved-analysis"),
    now: () => new Date(NOW),
    ...overrides,
  };
}
