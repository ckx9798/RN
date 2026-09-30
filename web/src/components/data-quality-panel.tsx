import type { DataQuality } from "@/lib/analysis/types";
import styles from "./data-quality-panel.module.css";

const PRODUCT_MATCH_LABEL: Record<DataQuality["productMatch"], string> = {
  matched: "제품을 찾았어요",
  ambiguous: "제품 후보가 여러 개예요",
  not_found: "제품을 찾지 못했어요",
  unavailable: "제품 데이터베이스에 연결하지 못했어요",
};

const API_STATUS_LABEL: Record<DataQuality["apiStatus"], string> = {
  ok: "정상",
  cache: "이전에 저장된 데이터를 사용했어요",
  error: "장애가 있었어요",
};

/**
 * 분석에 사용한 데이터가 얼마나 충분했는지 보여준다. `특이사항 없음`도
 * 데이터가 불완전하면 표시하지 않으므로, 사용자가 직접 데이터 상태를
 * 확인할 수 있게 한다(설계 12.1).
 */
export function DataQualityPanel({ dataQuality }: { dataQuality: DataQuality }) {
  return (
    <section className={styles.panel}>
      <h2 className={styles.title}>데이터 품질</h2>
      <dl className={styles.rows}>
        <div className={styles.row}>
          <dt className={styles.rowLabel}>OCR 텍스트 확인</dt>
          <dd className={styles.rowValue}>{dataQuality.ocrReviewed ? "확인함" : "확인하지 않음"}</dd>
        </div>
        <div className={styles.row}>
          <dt className={styles.rowLabel}>제품 매칭</dt>
          <dd className={styles.rowValue}>{PRODUCT_MATCH_LABEL[dataQuality.productMatch]}</dd>
        </div>
        <div className={styles.row}>
          <dt className={styles.rowLabel}>공공 데이터 상태</dt>
          <dd className={styles.rowValue}>{API_STATUS_LABEL[dataQuality.apiStatus]}</dd>
        </div>
        {dataQuality.sourceDate && (
          <div className={styles.row}>
            <dt className={styles.rowLabel}>데이터 기준일</dt>
            <dd className={styles.rowValue}>{dataQuality.sourceDate}</dd>
          </div>
        )}
      </dl>

      {dataQuality.conflicts.length > 0 && (
        <div className={styles.listBlock}>
          <h3 className={styles.listTitle}>확인된 충돌</h3>
          <ul className={styles.list}>
            {dataQuality.conflicts.map((item, index) => (
              <li key={index}>{item}</li>
            ))}
          </ul>
        </div>
      )}

      {dataQuality.missing.length > 0 && (
        <div className={styles.listBlock}>
          <h3 className={styles.listTitle}>부족한 데이터</h3>
          <ul className={styles.list}>
            {dataQuality.missing.map((item, index) => (
              <li key={index}>{item}</li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
