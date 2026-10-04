import { BRIDGE_VERSION, type ScanFailedV1, type ScanPayload, type ScanRequestV1 } from "./contract";
import { parseNativeMessage } from "./validate";

// 응답이 없을 때 대기하는 기본 시간(10분). 설계 6장은 구체적인 시간을
// 정하지 않았으므로 사용자가 촬영·재촬영을 반복할 여유를 넉넉히 둔다.
const DEFAULT_TIMEOUT_MS = 10 * 60 * 1000;

export type ScanOutcome =
  | { kind: "result"; payload: ScanPayload }
  | { kind: "cancelled" }
  | { kind: "failed"; code: ScanFailedV1["code"] };

type NativeWindow = Window & {
  ReactNativeWebView?: { postMessage: (message: string) => void };
};

export function isNativeApp(win: Window = window): boolean {
  const candidate = win as NativeWindow;
  return typeof candidate.ReactNativeWebView?.postMessage === "function";
}

function createDefaultRequestId(): string {
  return crypto.randomUUID();
}

type PendingRequest = {
  requestId: string;
  resolve: (outcome: ScanOutcome) => void;
  timeoutId: ReturnType<typeof setTimeout>;
};

export function createBridgeClient(
  win: Window,
  opts: { timeoutMs?: number; createId?: () => string } = {},
): { requestScan: () => Promise<ScanOutcome>; dispose: () => void } {
  const timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const createId = opts.createId ?? createDefaultRequestId;

  let pending: PendingRequest | null = null;
  let disposed = false;

  function settlePending(outcome: ScanOutcome) {
    if (!pending) {
      return;
    }
    clearTimeout(pending.timeoutId);
    const { resolve } = pending;
    pending = null;
    resolve(outcome);
  }

  function handleMessage(event: MessageEvent) {
    if (!pending || typeof event.data !== "string") {
      return;
    }

    const result = parseNativeMessage(event.data);
    if (!result.ok) {
      return;
    }

    const { message } = result;
    if (message.requestId !== pending.requestId) {
      return;
    }

    if (message.type === "SCAN_RESULT") {
      settlePending({ kind: "result", payload: message.payload });
      return;
    }
    if (message.type === "SCAN_CANCELLED") {
      settlePending({ kind: "cancelled" });
      return;
    }
    settlePending({ kind: "failed", code: message.code });
  }

  win.addEventListener("message", handleMessage);

  function requestScan(): Promise<ScanOutcome> {
    if (disposed) {
      return Promise.resolve({ kind: "failed", code: "unknown" });
    }

    if (pending) {
      settlePending({ kind: "cancelled" });
    }

    const requestId = createId();

    return new Promise<ScanOutcome>((resolve) => {
      const timeoutId = setTimeout(() => {
        settlePending({ kind: "failed", code: "unknown" });
      }, timeoutMs);

      pending = { requestId, resolve, timeoutId };

      const request: ScanRequestV1 = {
        version: BRIDGE_VERSION,
        type: "SCAN_REQUEST",
        requestId,
      };

      const nativeWin = win as NativeWindow;
      nativeWin.ReactNativeWebView?.postMessage(JSON.stringify(request));
    });
  }

  function dispose() {
    disposed = true;
    win.removeEventListener("message", handleMessage);
    if (pending) {
      settlePending({ kind: "cancelled" });
    }
  }

  return { requestScan, dispose };
}
