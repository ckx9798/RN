"use client";

import { createContext, useContext, useMemo, useState, type ReactNode } from "react";
import type { ScanPayload } from "@/lib/native-bridge/contract";
import type { ProductCandidate } from "@/lib/analysis/types";

/**
 * 후보 선택이 필요한 스캔 결과를 홈 → 후보 선택 화면으로 넘기기 위한
 * 상태다. 설계 14장에 따라 스캔 원문은 메모리(React Context)에만
 * 두고 localStorage·sessionStorage 등 영구 저장소에는 절대 쓰지
 * 않는다. 새로고침하거나 화면을 벗어나면 사라진다.
 */
export type PendingScan = {
  scan: ScanPayload;
  candidates: ProductCandidate[];
  draftAnalysisId: string;
};

type ScanSessionContextValue = {
  pending: PendingScan | null;
  setPending: (p: PendingScan | null) => void;
};

const ScanSessionContext = createContext<ScanSessionContextValue | null>(null);

export function ScanSessionProvider({ children }: { children: ReactNode }) {
  const [pending, setPending] = useState<PendingScan | null>(null);

  const value = useMemo(() => ({ pending, setPending }), [pending]);

  return <ScanSessionContext.Provider value={value}>{children}</ScanSessionContext.Provider>;
}

export function useScanSession(): ScanSessionContextValue {
  const context = useContext(ScanSessionContext);
  if (!context) {
    throw new Error("useScanSession은 ScanSessionProvider 안에서만 사용할 수 있어요.");
  }
  return context;
}
