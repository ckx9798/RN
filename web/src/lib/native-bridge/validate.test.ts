import { describe, expect, it } from "vitest";
import { containsForbiddenContent, parseNativeMessage } from "./validate";
import { MAX_BRIDGE_MESSAGE_BYTES } from "./contract";

const VALID_REQUEST_ID = "abcd1234-scan";

function validPayload() {
  return {
    productName: "테스트 제품",
    manufacturer: "테스트 제조사",
    reportNumber: "12345",
    ingredientsText: "밀가루, 설탕, 소금",
    allergenStatement: "밀 함유",
    crossContaminationStatement: null,
    rawText: "라벨 원문",
    userReviewed: true as const,
  };
}

describe("containsForbiddenContent", () => {
  it("data URI base64 이미지를 감지한다", () => {
    expect(
      containsForbiddenContent("data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD"),
    ).toBe(true);
  });

  it("file:// URI를 감지한다", () => {
    expect(containsForbiddenContent("file:///var/mobile/tmp/scan.jpg")).toBe(true);
  });

  it("content:// URI를 감지한다", () => {
    expect(containsForbiddenContent("content://media/external/images/1")).toBe(true);
  });

  it("500자 이상 이어진 base64-like 문자열을 감지한다", () => {
    expect(containsForbiddenContent("A".repeat(500))).toBe(true);
  });

  it("JWT 형태 문자열을 감지한다", () => {
    expect(
      containsForbiddenContent(
        "eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.dozjgNryP4J3jVmNHl0w5N_XgL0n3I9PlFUP0THsR8U",
      ),
    ).toBe(true);
  });

  it("정상 텍스트는 통과시킨다", () => {
    expect(containsForbiddenContent("밀가루, 설탕, 소금")).toBe(false);
  });
});

describe("parseNativeMessage", () => {
  it("정상 SCAN_RESULT 메시지를 통과시킨다", () => {
    const message = {
      version: 1,
      type: "SCAN_RESULT",
      requestId: VALID_REQUEST_ID,
      payload: validPayload(),
    };

    const result = parseNativeMessage(JSON.stringify(message));

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.message).toEqual(message);
    }
  });

  it("정상 SCAN_CANCELLED 메시지를 통과시킨다", () => {
    const message = { version: 1, type: "SCAN_CANCELLED", requestId: VALID_REQUEST_ID };

    const result = parseNativeMessage(JSON.stringify(message));

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.message).toEqual(message);
    }
  });

  it("정상 SCAN_FAILED 메시지를 통과시킨다", () => {
    const message = {
      version: 1,
      type: "SCAN_FAILED",
      requestId: VALID_REQUEST_ID,
      code: "ocr_failed",
    };

    const result = parseNativeMessage(JSON.stringify(message));

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.message).toEqual(message);
    }
  });

  it("문자열이 아니면 not_string을 반환한다", () => {
    const result = parseNativeMessage({ version: 1 });

    expect(result).toEqual({ ok: false, reason: "not_string" });
  });

  it("64KB를 초과하면 too_large를 반환한다", () => {
    const huge = JSON.stringify({
      version: 1,
      type: "SCAN_RESULT",
      requestId: VALID_REQUEST_ID,
      payload: { ...validPayload(), rawText: "가".repeat(MAX_BRIDGE_MESSAGE_BYTES) },
    });

    const result = parseNativeMessage(huge);

    expect(result).toEqual({ ok: false, reason: "too_large" });
  });

  it("JSON 파싱에 실패하면 invalid_json을 반환한다", () => {
    const result = parseNativeMessage("{not-json");

    expect(result).toEqual({ ok: false, reason: "invalid_json" });
  });

  it("version이 1이 아니면 unsupported_version을 반환한다", () => {
    const message = {
      version: 2,
      type: "SCAN_CANCELLED",
      requestId: VALID_REQUEST_ID,
    };

    const result = parseNativeMessage(JSON.stringify(message));

    expect(result).toEqual({ ok: false, reason: "unsupported_version" });
  });

  it("알 수 없는 type이면 unknown_type을 반환한다", () => {
    const message = { version: 1, type: "EVAL", requestId: VALID_REQUEST_ID };

    const result = parseNativeMessage(JSON.stringify(message));

    expect(result).toEqual({ ok: false, reason: "unknown_type" });
  });

  it("payload에 추가 키가 있으면 invalid_shape을 반환한다", () => {
    const message = {
      version: 1,
      type: "SCAN_RESULT",
      requestId: VALID_REQUEST_ID,
      payload: { ...validPayload(), extra: "no" },
    };

    const result = parseNativeMessage(JSON.stringify(message));

    expect(result).toEqual({ ok: false, reason: "invalid_shape" });
  });

  it("userReviewed가 false이면 invalid_shape을 반환한다", () => {
    const message = {
      version: 1,
      type: "SCAN_RESULT",
      requestId: VALID_REQUEST_ID,
      payload: { ...validPayload(), userReviewed: false },
    };

    const result = parseNativeMessage(JSON.stringify(message));

    expect(result).toEqual({ ok: false, reason: "invalid_shape" });
  });

  it("알 수 없는 SCAN_FAILED code이면 invalid_shape을 반환한다", () => {
    const message = {
      version: 1,
      type: "SCAN_FAILED",
      requestId: VALID_REQUEST_ID,
      code: "not_a_real_code",
    };

    const result = parseNativeMessage(JSON.stringify(message));

    expect(result).toEqual({ ok: false, reason: "invalid_shape" });
  });

  it("payload에 data URI base64 이미지가 있으면 forbidden_content를 반환한다", () => {
    const message = {
      version: 1,
      type: "SCAN_RESULT",
      requestId: VALID_REQUEST_ID,
      payload: {
        ...validPayload(),
        rawText: "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD",
      },
    };

    const result = parseNativeMessage(JSON.stringify(message));

    expect(result).toEqual({ ok: false, reason: "forbidden_content" });
  });

  it("payload에 file:// URI가 있으면 forbidden_content를 반환한다", () => {
    const message = {
      version: 1,
      type: "SCAN_RESULT",
      requestId: VALID_REQUEST_ID,
      payload: { ...validPayload(), rawText: "file:///var/mobile/tmp/scan.jpg" },
    };

    const result = parseNativeMessage(JSON.stringify(message));

    expect(result).toEqual({ ok: false, reason: "forbidden_content" });
  });

  it("payload에 JWT 문자열이 있으면 forbidden_content를 반환한다", () => {
    const message = {
      version: 1,
      type: "SCAN_RESULT",
      requestId: VALID_REQUEST_ID,
      payload: {
        ...validPayload(),
        rawText:
          "eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.dozjgNryP4J3jVmNHl0w5N_XgL0n3I9PlFUP0THsR8U",
      },
    };

    const result = parseNativeMessage(JSON.stringify(message));

    expect(result).toEqual({ ok: false, reason: "forbidden_content" });
  });
});
