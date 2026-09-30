import { redirect } from "next/navigation";
import { createServerSupabase } from "@/lib/supabase/server";
import { PageHeader } from "@/components/page-header";
import { HomeScanPanel, type RecentAnalysis } from "./home-scan-panel";
import styles from "./home.module.css";

type ProfileConsentRow = { consent_version: string | null };
type RecentAnalysisRow = {
  id: string;
  status: RecentAnalysis["status"];
  product_snapshot: { name: string } | null;
  created_at: string;
};

/**
 * 로그인 후 첫 화면이다. 개인화 설정에 동의하지 않았다면(프로필이 없거나
 * consent_version이 비어 있으면) 먼저 `/profile`로 보낸다. 그다음 스캔
 * 진입점과 최근 분석 3건을 보여준다(작업 브리프 W3 Step 2).
 */
export default async function ServiceHomePage() {
  const supabase = await createServerSupabase();
  const { data, error } = await supabase.auth.getClaims();

  if (error || !data) {
    redirect("/login");
  }

  const userId = data.claims.sub;

  const { data: profileRow } = await supabase
    .from("profiles")
    .select("consent_version")
    .eq("user_id", userId)
    .maybeSingle();

  if (!(profileRow as ProfileConsentRow | null)?.consent_version) {
    redirect("/profile");
  }

  const { data: recentRows } = await supabase
    .from("analyses")
    .select("id, status, product_snapshot, created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(3);

  const recent: RecentAnalysis[] = ((recentRows as RecentAnalysisRow[] | null) ?? []).map((row) => ({
    id: row.id,
    status: row.status,
    productName: row.product_snapshot?.name ?? null,
    createdAt: row.created_at,
  }));

  return (
    <div className={styles.page}>
      <PageHeader title="홈" />
      <HomeScanPanel recent={recent} />
    </div>
  );
}
