import { PageHeader } from "@/components/page-header";
import { CandidatePicker } from "./candidate-picker";
import styles from "../analyses.module.css";

/**
 * `analyzeFood` 응답에 후보가 여럿일 때 보여주는 후보 선택 화면이다.
 * 실제 상태(스캔 텍스트·후보 목록)는 `ScanSessionProvider`가 메모리로만
 * 들고 있으므로, 이 페이지 자체는 레이아웃만 맡고 로직은
 * `CandidatePicker`(클라이언트 컴포넌트)에 둔다.
 */
export default function CandidateSelectPage() {
  return (
    <div className={styles.page}>
      <PageHeader title="제품 선택" backHref="/" />
      <CandidatePicker />
    </div>
  );
}
