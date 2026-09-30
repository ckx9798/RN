import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from 'react';

import type { NativeToWebMessage } from '@/shared/config/bridge-contract';

export type ScanSession = { requestId: string } | null;

type ScanSessionContextValue = {
  active: ScanSession;
  start(requestId: string): void;
  complete(msg: NativeToWebMessage): void;
  outbox: NativeToWebMessage[];
  drain(): NativeToWebMessage[];
};

const ScanSessionContext = createContext<ScanSessionContextValue | null>(null);

export function ScanSessionProvider({ children }: { children: ReactNode }) {
  const [active, setActive] = useState<ScanSession>(null);
  const [outbox, setOutbox] = useState<NativeToWebMessage[]>([]);
  // outbox 상태는 리렌더 트리거용이고, ref가 항상 최신 배열을 동기적으로 들고 있다.
  // drain()이 setState의 비동기 배칭과 무관하게 정확한 값을 즉시 반환하기 위함이다.
  const outboxRef = useRef<NativeToWebMessage[]>([]);

  const start = useCallback((requestId: string) => {
    setActive({ requestId });
  }, []);

  const complete = useCallback((msg: NativeToWebMessage) => {
    outboxRef.current = [...outboxRef.current, msg];
    setOutbox(outboxRef.current);
    setActive(null);
  }, []);

  const drain = useCallback(() => {
    const drained = outboxRef.current;
    outboxRef.current = [];
    setOutbox(outboxRef.current);
    return drained;
  }, []);

  const value = useMemo<ScanSessionContextValue>(
    () => ({ active, start, complete, outbox, drain }),
    [active, outbox, start, complete, drain],
  );

  return <ScanSessionContext.Provider value={value}>{children}</ScanSessionContext.Provider>;
}

export function useScanSession(): ScanSessionContextValue {
  const context = useContext(ScanSessionContext);
  if (!context) {
    throw new Error('useScanSession은 ScanSessionProvider 내부에서만 사용할 수 있어요.');
  }
  return context;
}
