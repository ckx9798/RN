// 결과·이력 화면에서 함께 쓰는 표시용 순수 함수와 문구 상수다. 설계
// 문서 12장과 작업 브리프 W3 인터페이스를 그대로 따른다. 사용자에게
// 단정적으로 읽힐 수 있는 문구는 여기에도, 다른 어떤 소스 파일에도 쓰지
// 않는다 — `copy-guard.test.ts`가 금지어 목록으로 강제한다.

import type { AnalysisResult, Finding } from "./types";

export const STATUS_LABEL: Record<AnalysisResult["status"], string> = {
  caution: "주의",
  needs_review: "확인 필요",
  no_flags: "특이사항 없음",
};

export const SOURCE_LABEL: Record<Finding["source"], string> = {
  label: "제품 라벨",
  mfds_api: "식약처 API",
  user_profile: "내 설정",
  rule: "분석 규칙",
};

export const NO_FLAGS_NOTICE =
  "현재 확인 가능한 정보에서 주의 항목을 찾지 못했어요. 실제 제품 표시를 다시 확인해 주세요.";

export const DISCLAIMER =
  "이 결과는 의료 진단·치료·처방이나 섭취 허가가 아니에요. 공공 데이터와 촬영 정보에 없는 성분이 있을 수 있어요.";

const SEVERITY_ORDER: Record<Finding["severity"], number> = {
  caution: 0,
  needs_review: 1,
  info: 2,
};

/**
 * finding을 `주의 → 확인 필요 → info` 순으로 정렬한 새 배열을 반환한다.
 * 입력 배열은 바꾸지 않는다. 같은 심각도 안에서는 원래 순서(대개 서버가
 * 정한 sort_order)를 유지한다.
 */
export function sortFindings(findings: Finding[]): Finding[] {
  return [...findings].sort((a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity]);
}
