import Link from "next/link";
import styles from "./page-header.module.css";

/**
 * `(service)` 화면들이 공통으로 쓰는 상단 헤더. `backHref`가 있으면
 * 이전 화면으로 돌아가는 링크를 왼쪽에 보여준다.
 */
export function PageHeader({ title, backHref }: { title: string; backHref?: string }) {
  return (
    <header className={styles.header}>
      {backHref ? (
        <Link href={backHref} className={styles.backLink} aria-label="이전으로">
          ←
        </Link>
      ) : null}
      <h1 className={styles.title}>{title}</h1>
    </header>
  );
}
