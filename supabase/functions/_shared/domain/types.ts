// 공유 계약 타입 (설계 6장 C1, C2) + 분석 도메인 내부 타입.
// 이 파일은 브리지·HTTP 계약을 그대로 옮긴 타입 선언만 담는다. 값은 없다.

// ---- C1. 브리지 메시지 (설계 6장) ----

export type ScanPayload = {
  productName: string | null; // <= 200자
  manufacturer: string | null; // <= 200자
  reportNumber: string | null; // 숫자만, <= 20자
  ingredientsText: string; // 1..8000자, 공백만이면 무효
  allergenStatement: string | null; // <= 1000자
  crossContaminationStatement: string | null; // <= 1000자
  rawText: string; // <= 20000자
  userReviewed: true;
};

// ---- C2. analyze-food / food-data HTTP 계약 ----

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

export type Nutrients = Partial<
  Record<NutrientKey, { value: number; unit: "kcal" | "g" | "mg" }>
>;

export type ProductCandidate = {
  id: string;
  reportNumber: string | null;
  name: string;
  manufacturer: string | null;
  score: number; // 0..1, 정렬용
};

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

export type AnalyzeFoodRequest = {
  scan: ScanPayload;
  selectedProductId?: string | null; // public_food_products.id(uuid)
};

export type AnalyzeFoodResponse = {
  analysisId: string;
  result: AnalysisResult;
  candidates: ProductCandidate[];
};

export type ApiError = {
  error: {
    code: "unauthorized" | "invalid_request" | "payload_too_large" | "rate_limited" | "internal";
    message: string;
  };
};

// ---- 분석 도메인 내부 타입 ----

export type AllergenTerm = {
  allergenId: string;
  term: string;
  matchType: "exact_token" | "phrase" | "label_context";
  confidence: "confirmed" | "possible";
  priority: number;
};

export type AllergenStandard = {
  id: string;
  name: string;
  sourceUrl: string;
};

export type DiseaseStandard = {
  id: string;
  name: string;
  analysisSupport: "exclusive" | "nutrition_candidate" | "limited" | "unsupported" | "memo_only";
  relatedNutrients: NutrientKey[];
};

export type DiseaseRule = {
  id: number;
  diseaseId: string;
  targetKey: NutrientKey;
  operator: "gt" | "gte" | "lt" | "lte";
  threshold: number | null;
  unit: "kcal" | "g" | "mg";
  severity: "caution" | "needs_review";
  message: string;
  evidenceUrl: string | null;
  ruleVersion: string;
  reviewedAt: string | null;
  active: boolean;
};

export type UserProfileSnapshot = {
  allergenIds: string[];
  diseaseIds: string[];
  hasNoKnownDisease: boolean;
  consentVersion: string;
};

export type IngredientNode = {
  raw: string;
  normalized: string;
  children: IngredientNode[];
};

export type AllergenMatch = {
  allergenId: string;
  term: string;
  matchedText: string;
  kind: "direct" | "cross_contamination";
  source: "label" | "mfds_api";
  matchType: AllergenTerm["matchType"] | "statement";
  confidence: "confirmed" | "possible";
};
