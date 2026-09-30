import Link from "next/link";
import { redirect } from "next/navigation";
import { createServerSupabase } from "@/lib/supabase/server";
import { PageHeader } from "@/components/page-header";
import { STATUS_LABEL } from "@/lib/analysis/present";
import type { AnalysisResult } from "@/lib/analysis/types";
import styles from "./analyses.module.css";

const PAGE_SIZE = 20;

type AnalysisListRow = {
  id: string;
  status: AnalysisResult["status"];
  product_snapshot: { name: string } | null;
  created_at: string;
};

function parsePage(value: string | string[] | undefined): number {
  const raw = Array.isArray(value) ? value[0] : value;
  const parsed = Number(raw);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : 1;
}

/**
 * 분석 이력 목록. 최신순 20건씩 `range`로 페이지네이션한다(작업
 * 브리프 W3 Step 4).
 */
export default async function AnalysesPage(props: PageProps<"/analyses">) {
  const searchParams = await props.searchParams;
  const page = parsePage(searchParams.page);

  const supabase = await createServerSupabase();
  const { data, error } = await supabase.auth.getClaims();

  if (error || !data) {
    redirect("/login");
  }

  const userId = data.claims.sub;

  const from = (page - 1) * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;

  const { data: rows, count } = await supabase
    .from("analyses")
    .select("id, status, product_snapshot, created_at", { count: "exact" })
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .range(from, to);

  const items = (rows as AnalysisListRow[] | null) ?? [];
  const total = count ?? items.length;
  const hasPrevPage = page > 1;
  const hasNextPage = from + items.length < total;

  return (
    <div className={styles.page}>
      <PageHeader title="분석 이력" />
      <div className={styles.listContainer}>
        {items.length === 0 ? (
          <p className={styles.empty}>아직 분석한 제품이 없어요.</p>
        ) : (
          <ul className={styles.list}>
            {items.map((row) => (
              <li key={row.id}>
                <Link href={`/analyses/${row.id}`} className={styles.listItem}>
                  <span className={styles.itemName}>
                    {row.product_snapshot?.name ?? "제품명 미확인"}
                  </span>
                  <span className={styles.itemMeta}>
                    <span className={styles.itemStatus} data-status={row.status}>
                      {STATUS_LABEL[row.status]}
                    </span>
                    <span className={styles.itemDate}>
                      {new Date(row.created_at).toLocaleDateString("ko-KR")}
                    </span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}

        {(hasPrevPage || hasNextPage) && (
          <nav className={styles.pagination} aria-label="이력 페이지">
            {hasPrevPage ? (
              <Link href={`/analyses?page=${page - 1}`} className={styles.pageLink}>
                이전
              </Link>
            ) : (
              <span className={styles.pageLinkDisabled}>이전</span>
            )}
            {hasNextPage ? (
              <Link href={`/analyses?page=${page + 1}`} className={styles.pageLink}>
                다음
              </Link>
            ) : (
              <span className={styles.pageLinkDisabled}>다음</span>
            )}
          </nav>
        )}
      </div>
    </div>
  );
}
