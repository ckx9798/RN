import { describe, expect, it } from "vitest";
import { rowToResult, type AnalysisRow } from "./load-analysis";

function findingRow(
  overrides: Partial<AnalysisRow["analysis_findings"][number]>,
): AnalysisRow["analysis_findings"][number] {
  return {
    category: "allergen",
    severity: "caution",
    standard_id: "FOOD-001",
    title: "땅콩",
    description: "설명",
    matched_text: "땅콩분말",
    source: "label",
    evidence_url: null,
    sort_order: 0,
    ...overrides,
  };
}

function row(overrides: Partial<AnalysisRow>): AnalysisRow {
  return {
    id: "analysis-1",
    status: "caution",
    product_snapshot: null,
    data_quality: {
      ocrReviewed: true,
      productMatch: "not_found",
      nutritionAvailable: false,
      apiStatus: "ok",
      conflicts: [],
      missing: [],
      sourceDate: null,
    },
    rule_set_version: "2026-09-30.1",
    created_at: "2026-09-30T00:00:00.000Z",
    analysis_findings: [],
    ...overrides,
  };
}

describe("rowToResult", () => {
  it("DB 행 최상위 필드를 AnalysisResult로 옮긴다", () => {
    const result = rowToResult(row({}));

    expect(result.status).toBe("caution");
    expect(result.product).toBeNull();
    expect(result.analyzedAt).toBe("2026-09-30T00:00:00.000Z");
    expect(result.ruleSetVersion).toBe("2026-09-30.1");
    expect(result.dataQuality.apiStatus).toBe("ok");
  });

  it("finding을 sort_order 오름차순으로 정렬한다", () => {
    const result = rowToResult(
      row({
        analysis_findings: [
          findingRow({ title: "두 번째", sort_order: 1 }),
          findingRow({ title: "첫 번째", sort_order: 0 }),
        ],
      }),
    );

    expect(result.findings.map((f) => f.title)).toEqual(["첫 번째", "두 번째"]);
  });

  it("snake_case 필드를 camelCase Finding으로 변환한다", () => {
    const result = rowToResult(
      row({
        analysis_findings: [
          findingRow({
            standard_id: "FOOD-001",
            matched_text: "땅콩분말",
            evidence_url: "https://example.com",
          }),
        ],
      }),
    );

    expect(result.findings[0]).toEqual({
      category: "allergen",
      severity: "caution",
      standardId: "FOOD-001",
      title: "땅콩",
      description: "설명",
      matchedText: "땅콩분말",
      source: "label",
      evidenceUrl: "https://example.com",
    });
  });
});
