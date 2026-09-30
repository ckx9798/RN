import styles from "./consent-notice.module.css";

const CONSENT_ITEMS = [
  "수집 항목: 알레르기 선택 정보, 질환 선택 정보, 분석 이력",
  "이용 목적: 사용자에게 맞춘 주의 정보를 보여주기 위해서만 사용해요",
  "보유 기간: 회원 탈퇴 시까지 보관해요",
  "삭제 방법: 설정의 회원 탈퇴를 선택하면 즉시 삭제돼요",
];

/**
 * 개인화 설정 저장 전에 보여주는 동의 안내. 설계 14장(개인정보와 보안)에
 * 따라 수집 항목·목적·보유·삭제 정책을 밝히고, 의료 행위가 아님을
 * 분명히 한다.
 */
export function ConsentNotice({
  checked,
  onChange,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <div className={styles.container}>
      <ul className={styles.list}>
        {CONSENT_ITEMS.map((item) => (
          <li key={item} className={styles.item}>
            {item}
          </li>
        ))}
      </ul>
      <p className={styles.disclaimer}>
        이 정보는 의료 진단·치료·처방을 제공하지 않아요.
      </p>
      <label className={styles.checkboxRow}>
        <input
          type="checkbox"
          checked={checked}
          onChange={(event) => onChange(event.target.checked)}
        />
        <span>위 내용에 동의해요.</span>
      </label>
    </div>
  );
}
