import { describe, expect, it, vi } from "vitest";
import { createManagedScanBridge } from "./scan-bridge-lifecycle";
import type { ScanOutcome } from "./bridge-client";

vi.mock("./bridge-client", () => ({
  createBridgeClient: vi.fn(),
}));

import { createBridgeClient } from "./bridge-client";

function fakeClient(requestScan: () => Promise<ScanOutcome>) {
  return { requestScan: vi.fn(requestScan), dispose: vi.fn() };
}

const fakeWindow = {} as unknown as Window;

describe("createManagedScanBridge", () => {
  it("dispose 이전에 도착한 결과는 그대로 반환한다", async () => {
    const client = fakeClient(async () => ({ kind: "cancelled" }));
    vi.mocked(createBridgeClient).mockReturnValue(client);

    const bridge = createManagedScanBridge(fakeWindow);
    const outcome = await bridge.requestScan();

    expect(outcome).toEqual({ kind: "cancelled" });
  });

  it("응답이 오기 전에 dispose되면 늦게 도착한 결과를 무시하고 null을 반환한다", async () => {
    let resolveScan!: (outcome: ScanOutcome) => void;
    const client = fakeClient(
      () =>
        new Promise<ScanOutcome>((resolve) => {
          resolveScan = resolve;
        }),
    );
    vi.mocked(createBridgeClient).mockReturnValue(client);

    const bridge = createManagedScanBridge(fakeWindow);
    const outcomePromise = bridge.requestScan();

    bridge.dispose();
    resolveScan({ kind: "result", payload: { userReviewed: true } as never });

    const outcome = await outcomePromise;

    expect(outcome).toBeNull();
  });

  it("dispose를 호출하면 이미 도착한 응답을 기다리던 내부 client의 dispose도 호출한다", () => {
    const client = fakeClient(async () => ({ kind: "cancelled" }));
    vi.mocked(createBridgeClient).mockReturnValue(client);

    const bridge = createManagedScanBridge(fakeWindow);
    bridge.dispose();

    expect(client.dispose).toHaveBeenCalledTimes(1);
  });

  it("dispose 이후에 requestScan을 호출해도 내부 client에 새로 요청한다(결과만 무시한다)", async () => {
    const client = fakeClient(async () => ({ kind: "cancelled" }));
    vi.mocked(createBridgeClient).mockReturnValue(client);

    const bridge = createManagedScanBridge(fakeWindow);
    bridge.dispose();

    const outcome = await bridge.requestScan();

    expect(outcome).toBeNull();
  });
});
