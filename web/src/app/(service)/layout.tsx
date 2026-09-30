import { redirect } from "next/navigation";
import Link from "next/link";
import { createServerSupabase } from "@/lib/supabase/server";
import { ScanSessionProvider } from "@/components/scan-session-provider";
import styles from "./layout.module.css";

/**
 * 로그인한 사용자만 쓰는 화면들의 공통 레이아웃이다. `proxy.ts`가 이미
 * 비로그인 사용자를 `/login`으로 보내지만, 레이아웃 단에서도 한 번 더
 * 확인해 서버 컴포넌트 트리만으로도 인증 여부를 검증하게 만든다.
 *
 * `ScanSessionProvider`로 감싸 홈 → 후보 선택 화면 사이에서 스캔 결과를
 * 메모리에만 유지한다(설계 14장, 영구 저장 금지).
 */
export default async function ServiceLayout({ children }: LayoutProps<"/">) {
  const supabase = await createServerSupabase();
  const { data, error } = await supabase.auth.getClaims();

  if (error || !data) {
    redirect("/login");
  }

  return (
    <ScanSessionProvider>
      <div className={styles.shell}>
        <main className={styles.main}>{children}</main>
        <nav className={styles.bottomNav}>
          <Link href="/" className={styles.navItem}>
            홈
          </Link>
          <Link href="/analyses" className={styles.navItem}>
            이력
          </Link>
          <Link href="/settings" className={styles.navItem}>
            설정
          </Link>
        </nav>
      </div>
    </ScanSessionProvider>
  );
}
