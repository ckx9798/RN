import { NO_FLAGS_NOTICE, STATUS_LABEL } from "@/lib/analysis/present";
import type { AnalysisResult } from "@/lib/analysis/types";
import styles from "./status-banner.module.css";

/**
 * 분석 상태를 보여주는 배너. `특이사항 없음`일 때는 설계 12.1에 따라
 * 단정적인 보장이 아니라는 안내를 항상 함께 표시한다.
 */
export function StatusBanner({ status }: { status: AnalysisResult["status"] }) {
  return (
    <div className={styles.banner} data-status={status}>
      <p className={styles.label}>{STATUS_LABEL[status]}</p>
      {status === "no_flags" && <p className={styles.notice}>{NO_FLAGS_NOTICE}</p>}
    </div>
  );
}
