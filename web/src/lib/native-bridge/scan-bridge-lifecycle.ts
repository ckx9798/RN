// `createBridgeClient`의 결과를 dispose 이후에는 더 쓰지 않게 감싸는
// 순수 로직이다. React에 의존하지 않으므로 렌더링 없이 단위 테스트할
// 수 있다. `use-scan-bridge.ts`가 이 로직을 컴포넌트 생명주기에
// 묶는다.

import { createBridgeClient, type ScanOutcome } from "./bridge-client";

export type ManagedScanBridge = {
  /**
   * 스캔을 요청한다. `dispose()`가 이미 호출됐거나, 응답이 도착하기
   * 전에 `dispose()`가 호출되면 결과를 버리고 `null`을 반환한다 —
   * 호출자가 언마운트된 화면에서 상태를 갱신하거나 라우팅하지 않게
   * 하기 위해서다.
   */
  requestScan: () => Promise<ScanOutcome | null>;
  /** 대기 중인 `message` 리스너를 즉시 정리하고 이후 결과를 무시한다. */
  dispose: () => void;
};

export function createManagedScanBridge(win: Window): ManagedScanBridge {
  const client = createBridgeClient(win);
  let disposed = false;

  return {
    async requestScan() {
      const outcome = await client.requestScan();
      return disposed ? null : outcome;
    },
    dispose() {
      disposed = true;
      client.dispose();
    },
  };
}
