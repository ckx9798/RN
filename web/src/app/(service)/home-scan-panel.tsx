"use client";

import { useRef, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createBrowserSupabase } from "@/lib/supabase/client";
import { isNativeApp } from "@/lib/native-bridge/bridge-client";
import { useScanBridge } from "@/lib/native-bridge/use-scan-bridge";
import type { ScanFailedV1, ScanPayload } from "@/lib/native-bridge/contract";
import { analyzeFood, OVERSIZED_SCAN_MESSAGE } from "@/lib/analysis/analyze-client";
import { STATUS_LABEL } from "@/lib/analysis/present";
import type { AnalysisResult } from "@/lib/analysis/types";
import { useScanSession } from "@/components/scan-session-provider";
import styles from "./home.module.css";

export type RecentAnalysis = {
  id: string;
  status: AnalysisResult["status"];
  productName: string | null;
  createdAt: string;
};

const SCAN_FAILURE_MESSAGE: Record<ScanFailedV1["code"], string> = {
  permission_denied: "카메라 권한이 필요해요. 기기 설정에서 카메라 권한을 켜 주세요.",
  ocr_failed: "글자를 인식하지 못했어요. 라벨이 잘 보이도록 다시 촬영해 주세요.",
  invalid_image: "사진을 확인하지 못했어요. 다시 촬영해 주세요.",
  unknown: "알 수 없는 문제가 발생했어요. 다시 시도해 주세요.",
};

const ANALYZE_ERROR_MESSAGE = "분석 요청을 보내지 못했어요. 다시 시도해 주세요.";

// 서버에는 `window`가 없어 네이티브 여부를 렌더링 중에 바로 읽을 수
// 없다. `useSyncExternalStore`로 하이드레이션 이후 클라이언트 값을
// 읽는다(구독 대상이 바뀌지 않으므로 `subscribe`는 아무 일도 하지
// 않는다).
function subscribeNoop() {
  return () => {};
}

function getServerIsNative() {
  return false;
}

/**
 * 홈 화면의 스캔 진입점이다. 설계 6장(브리지) · 13장(오류 처리)을 따라
 * 취소는 조용히 복귀하고, 실패는 코드별 안내를, 분석 요청 실패는 스캔
 * 텍스트를 이 화면(컴포넌트 상태)에 유지한 채 재시도 버튼을 보여준다.
 * 스캔 텍스트는 어떤 경우에도 로컬 저장소에 쓰지 않는다.
 */
export function HomeScanPanel({ recent }: { recent: RecentAnalysis[] }) {
  const router = useRouter();
  const supabase = useRef(createBrowserSupabase()).current;
  const { setPending } = useScanSession();
  const { requestScan } = useScanBridge();

  const isNative = useSyncExternalStore(subscribeNoop, isNativeApp, getServerIsNative);
  const [isBusy, setIsBusy] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [retryScan, setRetryScan] = useState<ScanPayload | null>(null);

  async function runAnalysis(scan: ScanPayload) {
    setIsBusy(true);
    setErrorMessage(null);

    const result = await analyzeFood(supabase, { scan });

    setIsBusy(false);

    if (!result.ok) {
      const oversized = result.code === "payload_too_large";
      setRetryScan(oversized ? null : scan);
      setErrorMessage(oversized ? OVERSIZED_SCAN_MESSAGE : ANALYZE_ERROR_MESSAGE);
      return;
    }

    setRetryScan(null);
    const { analysisId, candidates } = result.data;

    if (candidates.length > 0) {
      setPending({ scan, candidates, draftAnalysisId: analysisId });
      router.push("/analyses/select");
      return;
    }

    router.push(`/analyses/${analysisId}`);
  }

  async function handleScanPress() {
    setErrorMessage(null);
    setIsBusy(true);

    const outcome = await requestScan();

    if (!outcome) {
      // 응답을 기다리는 동안 화면을 벗어나 컴포넌트가 언마운트됐다.
      // 상태를 더 갱신하거나 라우팅하지 않는다.
      return;
    }

    if (outcome.kind === "cancelled") {
      setIsBusy(false);
      return;
    }

    if (outcome.kind === "failed") {
      setIsBusy(false);
      setErrorMessage(SCAN_FAILURE_MESSAGE[outcome.code]);
      return;
    }

    await runAnalysis(outcome.payload);
  }

  function handleRetry() {
    if (retryScan) {
      void runAnalysis(retryScan);
    }
  }

  return (
    <div className={styles.panel}>
      {isNative ? (
        <button
          type="button"
          className={styles.scanButton}
          onClick={handleScanPress}
          disabled={isBusy}
        >
          {isBusy ? "처리 중이에요…" : "라벨 촬영하기"}
        </button>
      ) : (
        <p className={styles.webNotice}>라벨 촬영은 앱에서만 사용할 수 있어요.</p>
      )}

      {errorMessage && (
        <div className={styles.errorBox}>
          <p className={styles.errorText}>{errorMessage}</p>
          {retryScan && (
            <button
              type="button"
              className={styles.retryButton}
              onClick={handleRetry}
              disabled={isBusy}
            >
              다시 시도
            </button>
          )}
        </div>
      )}

      <section className={styles.recentSection}>
        <h2 className={styles.recentTitle}>최근 분석</h2>
        {recent.length === 0 ? (
          <p className={styles.recentEmpty}>아직 분석한 제품이 없어요.</p>
        ) : (
          <ul className={styles.recentList}>
            {recent.map((item) => (
              <li key={item.id}>
                <Link href={`/analyses/${item.id}`} className={styles.recentItem}>
                  <span className={styles.recentName}>{item.productName ?? "제품명 미확인"}</span>
                  <span className={styles.recentStatus} data-status={item.status}>
                    {STATUS_LABEL[item.status]}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
