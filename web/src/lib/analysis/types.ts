// supabase/functions/_shared/domain/types.ts와 동일하게 유지한다.
// 이 파일과 서버 쪽 타입 중 하나를 바꾸면 다른 쪽도 함께 갱신해야 한다.
// 설계 문서 12.2, 작업 브리프 C2 계약을 그대로 옮긴다.

import type { ScanPayload } from "@/lib/native-bridge/contract";

export type AnalyzeFoodRequest = {
  scan: ScanPayload;
  selectedProductId?: string | null; // public_food_products.id(uuid). 후보 선택 후 재요청 시
};

export type ProductCandidate = {
  id: string;
  reportNumber: string | null;
  name: string;
  manufacturer: string | null;
  score: number; // 0..1, 정렬용
};

export type NutrientKey =
  | "energy"
  | "carbohydrate"
  | "sugars"
  | "protein"
  | "fat"
  | "saturated_fat"
  | "cholesterol"
  | "sodium"
  | "potassium"
  | "phosphorus"
  | "calcium";

export type Nutrients = Partial<Record<NutrientKey, { value: number; unit: "kcal" | "g" | "mg" }>>;

export type ProductMatch = {
  id: string;
  reportNumber: string | null;
  name: string;
  manufacturer: string | null;
  foodType: string | null;
  servingSize: string | null;
  nutrients: Nutrients | null;
  ingredientsText: string | null;
  sourceUpdatedAt: string | null;
  fetchedAt: string;
  matchType: "report_number" | "name_manufacturer" | "user_selected";
};

export type DataQuality = {
  ocrReviewed: boolean;
  productMatch: "matched" | "ambiguous" | "not_found" | "unavailable";
  nutritionAvailable: boolean;
  apiStatus: "ok" | "cache" | "error";
  conflicts: string[]; // 사람이 읽을 충돌 설명
  missing: string[]; // 부족한 데이터 설명
  sourceDate: string | null;
};

export type Finding = {
  category: "allergen" | "cross_contamination" | "disease_nutrition" | "data_quality";
  severity: "caution" | "needs_review" | "info";
  standardId: string | null;
  title: string;
  description: string;
  matchedText: string | null;
  source: "label" | "mfds_api" | "user_profile" | "rule";
  evidenceUrl: string | null;
};

export type AnalysisResult = {
  status: "caution" | "needs_review" | "no_flags";
  product: ProductMatch | null;
  findings: Finding[];
  dataQuality: DataQuality;
  analyzedAt: string;
  ruleSetVersion: string;
};

export type AnalyzeFoodResponse = {
  analysisId: string;
  result: AnalysisResult;
  candidates: ProductCandidate[]; // 비어 있지 않으면 웹이 후보 선택 화면을 띄운다
};

export type ApiError = {
  error: {
    code: "unauthorized" | "invalid_request" | "payload_too_large" | "rate_limited" | "internal";
    message: string;
  };
};
