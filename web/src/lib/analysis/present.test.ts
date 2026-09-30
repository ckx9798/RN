import { describe, expect, it } from "vitest";
import { DISCLAIMER, NO_FLAGS_NOTICE, SOURCE_LABEL, STATUS_LABEL, sortFindings } from "./present";
import type { Finding } from "./types";

function finding(overrides: Partial<Finding>): Finding {
  return {
    category: "allergen",
    severity: "info",
    standardId: null,
    title: "제목",
    description: "설명",
    matchedText: null,
    source: "label",
    evidenceUrl: null,
    ...overrides,
  };
}

describe("sortFindings", () => {
  it("주의 → 확인 필요 → info 순으로 정렬한다", () => {
    const findings = [
      finding({ severity: "info", title: "c" }),
      finding({ severity: "caution", title: "a" }),
      finding({ severity: "needs_review", title: "b" }),
    ];

    const sorted = sortFindings(findings);

    expect(sorted.map((f) => f.severity)).toEqual(["caution", "needs_review", "info"]);
  });

  it("같은 심각도 내에서는 원래 순서를 유지한다", () => {
    const findings = [
      finding({ severity: "caution", title: "first" }),
      finding({ severity: "caution", title: "second" }),
    ];

    const sorted = sortFindings(findings);

    expect(sorted.map((f) => f.title)).toEqual(["first", "second"]);
  });

  it("원본 배열을 변경하지 않는다", () => {
    const findings = [finding({ severity: "info" }), finding({ severity: "caution" })];
    const original = [...findings];

    sortFindings(findings);

    expect(findings).toEqual(original);
  });
});

describe("라벨 상수", () => {
  it("상태 라벨을 한국어로 제공한다", () => {
    expect(STATUS_LABEL.caution).toBe("주의");
    expect(STATUS_LABEL.needs_review).toBe("확인 필요");
    expect(STATUS_LABEL.no_flags).toBe("특이사항 없음");
  });

  it("출처 라벨을 한국어로 제공한다", () => {
    expect(SOURCE_LABEL.label).toBe("제품 라벨");
    expect(SOURCE_LABEL.mfds_api).toBe("식약처 API");
    expect(SOURCE_LABEL.user_profile).toBe("내 설정");
    expect(SOURCE_LABEL.rule).toBe("분석 규칙");
  });

  it("특이사항 없음 안내 문구와 디스클레이머를 제공한다", () => {
    expect(NO_FLAGS_NOTICE).toContain("주의 항목을 찾지 못했어요");
    expect(DISCLAIMER).toContain("의료 진단");
  });
});
