"use client";

import { useCallback, useEffect, useRef } from "react";
import { createManagedScanBridge, type ManagedScanBridge } from "./scan-bridge-lifecycle";
import type { ScanOutcome } from "./bridge-client";

/**
 * 브리지 클라이언트를 컴포넌트 마운트에 묶는다. 버튼을 누를 때마다
 * 새로 만들지 않고 마운트 시 한 번만 만들어 언마운트 시 반드시
 * `dispose()`한다. 사용자가 스캔 응답을 기다리는 중에 화면을 벗어나면
 * `dispose()`가 대기 중인 `message` 리스너를 즉시 정리하고, 그 뒤
 * 늦게 도착한 결과는 `requestScan()`이 `null`로 바꿔 반환하므로
 * 호출자가 언마운트된 화면에서 상태 갱신·라우팅을 하지 않는다.
 */
export function useScanBridge() {
  const bridgeRef = useRef<ManagedScanBridge | null>(null);

  useEffect(() => {
    const bridge = createManagedScanBridge(window);
    bridgeRef.current = bridge;

    return () => {
      bridge.dispose();
      bridgeRef.current = null;
    };
  }, []);

  const requestScan = useCallback((): Promise<ScanOutcome | null> => {
    const bridge = bridgeRef.current;
    if (!bridge) {
      return Promise.resolve(null);
    }
    return bridge.requestScan();
  }, []);

  return { requestScan };
}
