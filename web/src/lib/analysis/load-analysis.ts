// `analyses` + `analysis_findings` 조인 결과(DB 행)를 화면이 쓰는
// `AnalysisResult`로 변환한다. 작업 브리프 W3 인터페이스와 S1의 조회
// 쿼리(`.select('id,status,product_snapshot,data_quality,rule_set_version,
// created_at,analysis_findings(...)')`)를 그대로 따른다.

import type { AnalysisResult, DataQuality, Finding, ProductMatch } from "./types";

export type AnalysisFindingRow = {
  category: Finding["category"];
  severity: Finding["severity"];
  standard_id: string | null;
  title: string;
  description: string;
  matched_text: string | null;
  source: Finding["source"];
  evidence_url: string | null;
  sort_order: number;
};

export type AnalysisRow = {
  id: string;
  status: AnalysisResult["status"];
  product_snapshot: ProductMatch | null;
  data_quality: DataQuality;
  rule_set_version: string;
  created_at: string;
  analysis_findings: AnalysisFindingRow[];
};

function findingRowToFinding(row: AnalysisFindingRow): Finding {
  return {
    category: row.category,
    severity: row.severity,
    standardId: row.standard_id,
    title: row.title,
    description: row.description,
    matchedText: row.matched_text,
    source: row.source,
    evidenceUrl: row.evidence_url,
  };
}

export function rowToResult(row: AnalysisRow): AnalysisResult {
  const findings = [...row.analysis_findings]
    .sort((a, b) => a.sort_order - b.sort_order)
    .map(findingRowToFinding);

  return {
    status: row.status,
    product: row.product_snapshot,
    findings,
    dataQuality: row.data_quality,
    analyzedAt: row.created_at,
    ruleSetVersion: row.rule_set_version,
  };
}
