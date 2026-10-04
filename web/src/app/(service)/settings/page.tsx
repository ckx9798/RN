import Link from "next/link";
import { redirect } from "next/navigation";
import { createServerSupabase } from "@/lib/supabase/server";
import { PageHeader } from "@/components/page-header";
import { ConsentNotice } from "@/components/consent-notice";
import { SettingsActions } from "./settings-actions";
import styles from "./settings.module.css";

/**
 * 설정 화면. 개인화 설정 수정 링크, 개인정보 처리 안내(동의 문구
 * 재사용), 로그아웃·회원 탈퇴를 제공한다(작업 브리프 W3 Step 5).
 */
export default async function SettingsPage() {
  const supabase = await createServerSupabase();
  const { data, error } = await supabase.auth.getClaims();

  if (error || !data) {
    redirect("/login");
  }

  return (
    <div className={styles.page}>
      <PageHeader title="설정" />
      <div className={styles.content}>
        <Link href="/profile" className={styles.linkRow}>
          개인화 설정 수정
        </Link>

        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>개인정보 처리 안내</h2>
          <ConsentNotice checked readOnly />
        </section>

        <SettingsActions />
      </div>
    </div>
  );
}
