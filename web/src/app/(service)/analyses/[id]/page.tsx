import { notFound, redirect } from "next/navigation";
import { createServerSupabase } from "@/lib/supabase/server";
import { PageHeader } from "@/components/page-header";
import { AnalysisResultView } from "@/components/analysis-result-view";
import { rowToResult, type AnalysisRow } from "@/lib/analysis/load-analysis";
import styles from "../analyses.module.css";

/**
 * 분석 결과 상세. RLS가 소유자 외 접근을 막으므로 조회 조건은 `id`만
 * 쓴다(작업 브리프 DB facts, S1).
 */
export default async function AnalysisDetailPage(props: PageProps<"/analyses/[id]">) {
  const { id } = await props.params;

  const supabase = await createServerSupabase();
  const { data, error } = await supabase.auth.getClaims();

  if (error || !data) {
    redirect("/login");
  }

  const { data: row, error: rowError } = await supabase
    .from("analyses")
    .select(
      "id,status,product_snapshot,data_quality,rule_set_version,created_at,analysis_findings(category,severity,standard_id,title,description,matched_text,source,evidence_url,sort_order)",
    )
    .eq("id", id)
    .single();

  if (rowError || !row) {
    notFound();
  }

  const result = rowToResult(row as unknown as AnalysisRow);

  return (
    <div className={styles.page}>
      <PageHeader title="분석 결과" backHref="/analyses" />
      <AnalysisResultView result={result} />
    </div>
  );
}
