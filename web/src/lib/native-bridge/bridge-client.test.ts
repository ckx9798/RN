// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { createBridgeClient, isNativeApp } from "./bridge-client";
import { BRIDGE_VERSION } from "./contract";

function scanPayload() {
  return {
    productName: "테스트 제품",
    manufacturer: null,
    reportNumber: null,
    ingredientsText: "밀가루, 설탕",
    allergenStatement: null,
    crossContaminationStatement: null,
    rawText: "라벨 원문",
    userReviewed: true as const,
  };
}

function dispatchNativeMessage(win: Window, data: unknown) {
  win.dispatchEvent(new MessageEvent("message", { data: JSON.stringify(data) }));
}

describe("isNativeApp", () => {
  it("ReactNativeWebView.postMessage가 함수이면 true를 반환한다", () => {
    const fakeWindow = {
      ReactNativeWebView: { postMessage: vi.fn() },
    } as unknown as Window;

    expect(isNativeApp(fakeWindow)).toBe(true);
  });

  it("ReactNativeWebView가 없으면 false를 반환한다", () => {
    const fakeWindow = {} as unknown as Window;

    expect(isNativeApp(fakeWindow)).toBe(false);
  });
});

describe("createBridgeClient", () => {
  it("requestScan 호출 시 C1 형식의 SCAN_REQUEST를 postMessage로 보낸다", async () => {
    const postMessage = vi.fn();
    (window as unknown as { ReactNativeWebView: { postMessage: typeof postMessage } }).ReactNativeWebView = {
      postMessage,
    };

    const client = createBridgeClient(window, { createId: () => "fixed-request-id" });
    void client.requestScan();

    await Promise.resolve();

    expect(postMessage).toHaveBeenCalledTimes(1);
    const sent = JSON.parse(postMessage.mock.calls[0][0] as string);
    expect(sent).toEqual({
      version: BRIDGE_VERSION,
      type: "SCAN_REQUEST",
      requestId: "fixed-request-id",
    });

    client.dispose();
    delete (window as unknown as { ReactNativeWebView?: unknown }).ReactNativeWebView;
  });

  it("window message 이벤트로 결과를 전달하면 resolve한다", async () => {
    (window as unknown as { ReactNativeWebView: { postMessage: () => void } }).ReactNativeWebView = {
      postMessage: () => {},
    };

    const client = createBridgeClient(window, { createId: () => "req-result-1" });
    const outcomePromise = client.requestScan();

    dispatchNativeMessage(window, {
      version: 1,
      type: "SCAN_RESULT",
      requestId: "req-result-1",
      payload: scanPayload(),
    });

    const outcome = await outcomePromise;

    expect(outcome).toEqual({ kind: "result", payload: scanPayload() });

    client.dispose();
    delete (window as unknown as { ReactNativeWebView?: unknown }).ReactNativeWebView;
  });

  it("대기 중인 requestId와 다른 메시지는 무시한다", async () => {
    (window as unknown as { ReactNativeWebView: { postMessage: () => void } }).ReactNativeWebView = {
      postMessage: () => {},
    };

    const client = createBridgeClient(window, { createId: () => "req-mine" });
    const outcomePromise = client.requestScan();

    dispatchNativeMessage(window, {
      version: 1,
      type: "SCAN_RESULT",
      requestId: "req-other",
      payload: scanPayload(),
    });

    dispatchNativeMessage(window, { version: 1, type: "SCAN_CANCELLED", requestId: "req-mine" });

    const outcome = await outcomePromise;

    expect(outcome).toEqual({ kind: "cancelled" });

    client.dispose();
    delete (window as unknown as { ReactNativeWebView?: unknown }).ReactNativeWebView;
  });

  it("같은 결과를 두 번 보내도 한 번만 처리한다", async () => {
    (window as unknown as { ReactNativeWebView: { postMessage: () => void } }).ReactNativeWebView = {
      postMessage: () => {},
    };

    const client = createBridgeClient(window, { createId: () => "req-dup-1" });
    let resolveCount = 0;
    const outcomePromise = client.requestScan().then((outcome) => {
      resolveCount += 1;
      return outcome;
    });

    dispatchNativeMessage(window, {
      version: 1,
      type: "SCAN_RESULT",
      requestId: "req-dup-1",
      payload: scanPayload(),
    });

    const first = await outcomePromise;
    expect(first).toEqual({ kind: "result", payload: scanPayload() });
    expect(resolveCount).toBe(1);

    // 처리가 끝난 뒤 같은 메시지를 다시 보내도 대기 중인 요청이 없으므로
    // 무시된다(다시 resolve되지 않는다).
    dispatchNativeMessage(window, {
      version: 1,
      type: "SCAN_RESULT",
      requestId: "req-dup-1",
      payload: scanPayload(),
    });
    await Promise.resolve();
    expect(resolveCount).toBe(1);

    client.dispose();
    delete (window as unknown as { ReactNativeWebView?: unknown }).ReactNativeWebView;
  });

  it("타임아웃이 지나면 failed/unknown으로 resolve한다", async () => {
    vi.useFakeTimers();

    (window as unknown as { ReactNativeWebView: { postMessage: () => void } }).ReactNativeWebView = {
      postMessage: () => {},
    };

    const client = createBridgeClient(window, { createId: () => "req-timeout", timeoutMs: 1000 });
    const outcomePromise = client.requestScan();

    vi.advanceTimersByTime(1000);

    const outcome = await outcomePromise;

    expect(outcome).toEqual({ kind: "failed", code: "unknown" });

    client.dispose();
    delete (window as unknown as { ReactNativeWebView?: unknown }).ReactNativeWebView;
    vi.useRealTimers();
  });

  it("대기 중 재요청 시 이전 요청을 cancelled로 종료한다", async () => {
    (window as unknown as { ReactNativeWebView: { postMessage: () => void } }).ReactNativeWebView = {
      postMessage: () => {},
    };

    const client = createBridgeClient(window, { createId: () => "req-second" });
    const firstPromise = client.requestScan();
    const secondPromise = client.requestScan();

    const firstOutcome = await firstPromise;
    expect(firstOutcome).toEqual({ kind: "cancelled" });

    dispatchNativeMessage(window, { version: 1, type: "SCAN_CANCELLED", requestId: "req-second" });
    const secondOutcome = await secondPromise;
    expect(secondOutcome).toEqual({ kind: "cancelled" });

    client.dispose();
    delete (window as unknown as { ReactNativeWebView?: unknown }).ReactNativeWebView;
  });

  it("dispose() 이후에는 메시지를 받아도 아무 것도 하지 않는다(리스너 제거)", async () => {
    (window as unknown as { ReactNativeWebView: { postMessage: () => void } }).ReactNativeWebView = {
      postMessage: () => {},
    };

    const removeEventListenerSpy = vi.spyOn(window, "removeEventListener");

    const client = createBridgeClient(window, { createId: () => "req-dispose-1" });
    const outcomePromise = client.requestScan();

    client.dispose();

    expect(removeEventListenerSpy).toHaveBeenCalledWith("message", expect.any(Function));

    // dispose 시점에 대기 중이던 요청은 cancelled로 정리된다.
    await expect(outcomePromise).resolves.toEqual({ kind: "cancelled" });

    // 리스너가 제거됐으므로 이후 같은 requestId로 메시지를 보내도 예외
    // 없이 무시된다. 대기 중인 요청이 없으므로 아무 상태도 바뀌지 않는다.
    expect(() =>
      dispatchNativeMessage(window, {
        version: 1,
        type: "SCAN_RESULT",
        requestId: "req-dispose-1",
        payload: scanPayload(),
      }),
    ).not.toThrow();

    removeEventListenerSpy.mockRestore();
    delete (window as unknown as { ReactNativeWebView?: unknown }).ReactNativeWebView;
  });
});
