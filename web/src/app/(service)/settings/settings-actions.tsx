"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createBrowserSupabase } from "@/lib/supabase/client";
import styles from "./settings.module.css";

const DELETE_ERROR_MESSAGE = "탈퇴를 처리하지 못했어요. 잠시 후 다시 시도해 주세요.";
const LOGOUT_ERROR_MESSAGE = "로그아웃하지 못했어요. 잠시 후 다시 시도해 주세요.";

/**
 * 로그아웃과 회원 탈퇴. 탈퇴는 `confirm()` 대화상자 대신 페이지 내
 * 2단계 버튼으로 확인받은 뒤 `delete_my_account` RPC를 호출한다(작업
 * 브리프 W3 Step 5, 설계 14장).
 */
export function SettingsActions() {
  const router = useRouter();
  const supabase = useRef(createBrowserSupabase()).current;

  const [isConfirmingDelete, setIsConfirmingDelete] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  async function handleLogout() {
    if (isProcessing) {
      return;
    }

    setIsProcessing(true);
    setErrorMessage(null);

    const { error } = await supabase.auth.signOut();

    if (error) {
      setIsProcessing(false);
      setErrorMessage(LOGOUT_ERROR_MESSAGE);
      return;
    }

    router.replace("/login");
  }

  async function handleDeleteConfirmed() {
    if (isProcessing) {
      return;
    }

    setIsProcessing(true);
    setErrorMessage(null);

    const { error: rpcError } = await supabase.rpc("delete_my_account");

    if (rpcError) {
      setIsProcessing(false);
      setErrorMessage(DELETE_ERROR_MESSAGE);
      return;
    }

    await supabase.auth.signOut();
    router.replace("/login");
  }

  return (
    <div className={styles.actions}>
      <button
        type="button"
        className={styles.logoutButton}
        onClick={handleLogout}
        disabled={isProcessing}
      >
        로그아웃
      </button>

      {isConfirmingDelete ? (
        <div className={styles.confirmBox}>
          <p className={styles.confirmText}>
            탈퇴하면 프로필, 알레르기·질환 선택 정보와 분석 이력이 모두 삭제돼요. 이 작업은
            되돌릴 수 없어요.
          </p>
          <div className={styles.confirmRow}>
            <button
              type="button"
              className={styles.secondaryButton}
              onClick={() => setIsConfirmingDelete(false)}
              disabled={isProcessing}
            >
              취소
            </button>
            <button
              type="button"
              className={styles.dangerButton}
              onClick={handleDeleteConfirmed}
              disabled={isProcessing}
            >
              정말 탈퇴할게요
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          className={styles.dangerButtonOutline}
          onClick={() => setIsConfirmingDelete(true)}
          disabled={isProcessing}
        >
          회원 탈퇴
        </button>
      )}

      {errorMessage && <p className={styles.errorText}>{errorMessage}</p>}
    </div>
  );
}
