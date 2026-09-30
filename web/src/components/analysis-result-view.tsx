import { DISCLAIMER } from "@/lib/analysis/present";
import type { AnalysisResult } from "@/lib/analysis/types";
import { StatusBanner } from "./status-banner";
import { FindingList } from "./finding-list";
import { DataQualityPanel } from "./data-quality-panel";
import styles from "./analysis-result-view.module.css";

/**
 * 분석 결과 상세 화면의 본문. 결과 상세 페이지와(향후 필요하다면) 다른
 * 화면에서도 재사용할 수 있게 서버·클라이언트 구분 없는 순수 표시
 * 컴포넌트로 만든다.
 */
export function AnalysisResultView({ result }: { result: AnalysisResult }) {
  return (
    <div className={styles.view}>
      <StatusBanner status={result.status} />

      {result.product && (
        <section className={styles.productCard}>
          <h2 className={styles.productName}>{result.product.name}</h2>
          {result.product.manufacturer && (
            <p className={styles.productMeta}>{result.product.manufacturer}</p>
          )}
          <p className={styles.productSource}>
            출처: 식약처 공공 데이터
            {result.product.sourceUpdatedAt ? ` · 기준일 ${result.product.sourceUpdatedAt}` : ""}
          </p>
        </section>
      )}

      <FindingList findings={result.findings} />

      <DataQualityPanel dataQuality={result.dataQuality} />

      <p className={styles.disclaimer}>{DISCLAIMER}</p>
    </div>
  );
}
