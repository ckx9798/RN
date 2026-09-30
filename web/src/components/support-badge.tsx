import { SUPPORT_LABEL, type DiseaseSupport } from "@/lib/profile/profile-form";
import styles from "./support-badge.module.css";

/**
 * 질환 항목 옆에 붙어 자동 분석 지원 수준을 알려주는 배지.
 * "분석 지원" · "일부 지원" · "정보 저장만" · "선택 상태" 중 하나만 표시하며,
 * 어떤 문구도 섭취 가능 여부를 판정하는 것으로 오해되지 않게 한다.
 */
export function SupportBadge({ support }: { support: DiseaseSupport }) {
  return (
    <span className={styles.badge} data-support={support}>
      {SUPPORT_LABEL[support]}
    </span>
  );
}
