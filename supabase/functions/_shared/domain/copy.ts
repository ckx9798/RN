// 사용자 문구 상수 (브리프 금지어 규칙, 설계 12.1).
//
// 금지어: 안심, 안전, 섭취 적합. 부정문에도 쓰지 않는다. copy.test.ts가
// COPY의 모든 문자열과 도메인 모듈이 만드는 title/description 샘플에
// 금지어가 없음을 강제한다.

import type { NutrientKey } from "./types.ts";

export const RULE_SET_VERSION = "2026-09-30.1";

export const FORBIDDEN_WORDS = ["안심", "안전", "섭취 적합"] as const;

/** 영양소 키 -> 한글 표기. decide-status/disease-evaluator가 공유한다(M4). */
export const NUTRIENT_NAMES: Record<NutrientKey, string> = {
  energy: "열량",
  carbohydrate: "탄수화물",
  sugars: "당류",
  protein: "단백질",
  fat: "지방",
  saturated_fat: "포화지방",
  cholesterol: "콜레스테롤",
  sodium: "나트륨",
  potassium: "칼륨",
  phosphorus: "인",
  calcium: "칼슘",
};

/** "{key}" 자리표시자를 vars 값으로 채운다. decide-status/disease-evaluator가 공유한다(M5). */
export function fillTemplate(template: string, vars: Record<string, string>): string {
  return Object.entries(vars).reduce(
    (text, [key, value]) => text.replaceAll(`{${key}}`, value),
    template,
  );
}

export const COPY = {
  noFlagsNotice:
    "현재 확인 가능한 정보에서 주의 항목을 찾지 못했어요. 실제 제품 표시를 다시 확인해 주세요.",

  allergenIncludedSuffix: "포함",
  allergenCrossSuffix: "교차혼입 가능",
  allergenNeedsReviewSuffix: "확인 필요",

  allergenDirectDescription:
    '라벨에서 "{matchedText}" 표현이 발견됐어요. 등록하신 알레르기 기준과 일치해요.',
  allergenCrossDescription:
    '교차혼입 안내에서 "{matchedText}" 표현이 발견됐어요. 제조 과정에서 섞였을 가능성이 있어요.',
  allergenPossibleDescription:
    '"{matchedText}" 표현이 있어 확인이 필요해요. 이 표현만으로는 등록하신 알레르기 여부를 확정하지 않았어요.',

  diseaseUnsupportedDescription:
    "이 질환은 자동 분석 대상이 아니에요. 실제 제품 표시와 전문가 상담을 참고해 주세요.",
  diseaseMemoOnlyDescription:
    "자유롭게 남긴 메모는 자동 분석에 사용하지 않아요. 실제 제품 표시를 다시 확인해 주세요.",
  diseaseMissingNutrientsDescription:
    "이 질환과 관련된 영양정보가 없어 판단할 수 없어요. 실제 제품 표시를 다시 확인해 주세요.",
  diseaseLimitedNoNutrientsDescription:
    "이 질환은 일부 항목만 지원돼요. 관련 영양정보 기준이 아직 없어 자동 분석 대상이 아니에요.",
  diseaseUnitMismatchDescription:
    "규칙 단위와 영양정보 단위가 달라 자동 판정을 실행하지 않았어요. 표시된 값을 직접 확인해 주세요.",
  diseaseNutrientInfoDescriptionTemplate: "{nutrient} {value}{unit}로 표시되어 있어요.",

  unsupportedTitleSuffix: "자동 분석 대상 아님",
  memoOnlyTitleSuffix: "정보 저장만",
  needsReviewTitleSuffix: "확인 필요",
  nutrientInfoTitleSuffix: "영양정보",
  cautionTitleSuffix: "주의",
} as const;
