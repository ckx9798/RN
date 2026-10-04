import { SOURCE_LABEL, sortFindings } from "@/lib/analysis/present";
import type { Finding } from "@/lib/analysis/types";
import styles from "./finding-list.module.css";

/**
 * 판정 근거 목록. 심각도 순으로 정렬해 보여주고, 근거 링크는 네이티브가
 * 시스템 브라우저로 열도록 `target="_blank" rel="noopener noreferrer"`를
 * 쓴다(작업 브리프 W3 Step 4).
 */
export function FindingList({ findings }: { findings: Finding[] }) {
  const sorted = sortFindings(findings);

  if (sorted.length === 0) {
    return (
      <section className={styles.section}>
        <h2 className={styles.title}>판정 근거</h2>
        <p className={styles.empty}>표시할 근거가 없어요.</p>
      </section>
    );
  }

  return (
    <section className={styles.section}>
      <h2 className={styles.title}>판정 근거</h2>
      <ul className={styles.list}>
        {sorted.map((finding, index) => (
          <li
            key={`${finding.standardId ?? finding.category}-${index}`}
            className={styles.item}
            data-severity={finding.severity}
          >
            <p className={styles.itemTitle}>{finding.title}</p>
            <p className={styles.itemDescription}>{finding.description}</p>
            {finding.matchedText && (
              <p className={styles.matchedText}>&ldquo;{finding.matchedText}&rdquo;</p>
            )}
            <div className={styles.meta}>
              <span className={styles.source}>{SOURCE_LABEL[finding.source]}</span>
              {finding.evidenceUrl && (
                <a
                  href={finding.evidenceUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={styles.evidenceLink}
                >
                  근거 보기
                </a>
              )}
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
