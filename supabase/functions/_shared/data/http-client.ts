// 공공 API 클라이언트 공용 유틸 (타임아웃 fetch, 공통 에러, 공통 출력 타입).
// mfds-nutrition-client.ts / foodsafety-c002-client.ts가 공유한다.

import type { Nutrients } from "../domain/types.ts";

export type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

/** 두 클라이언트 공통 출력 형태. */
export type PublicProductRecord = {
  service: "mfds_nutrition" | "foodsafety_c002";
  reportNumber: string | null;
  name: string;
  manufacturer: string | null;
  foodType: string | null;
  servingSize: string | null;
  nutrients: Nutrients | null;
  ingredientsText: string | null;
  sourceUpdatedAt: string | null;
  raw: unknown;
};

/**
 * 공공 API 호출 실패. 메시지는 항상 고정 문구만 담고, URL·서비스 키·응답
 * 본문은 절대 포함하지 않는다(로그·에러 메시지에 API 키가 노출되지 않도록).
 */
export class PublicApiError extends Error {
  constructor(
    readonly service: "mfds_nutrition" | "foodsafety_c002",
    readonly reason: "timeout" | "http" | "parse" | "config",
  ) {
    super(`${service} 공공 API 오류: ${reason}`);
    this.name = "PublicApiError";
  }
}

/**
 * 타임아웃이 걸린 fetch. `fetcher`가 AbortSignal을 존중해 reject하는 것을
 * 전제로 한다(표준 `fetch`는 이를 지킨다). !ok 응답과 JSON 파싱 실패도
 * `PublicApiError`로 통일해 던진다.
 *
 * brief의 시그니처(`fetchJson(fetcher, url, timeoutMs)`)에는 없던 `service`
 * 인자를 추가했다 — `PublicApiError`가 서비스별 태그를 요구하는데 fetchJson은
 * 여러 서비스에서 공유되므로, 호출자가 서비스를 알려주지 않으면 올바른
 * `service` 값을 채울 방법이 없다. 계약 위반이 아니라 그 계약을 성립시키기
 * 위한 보강으로 판단해 추가했다.
 */
export async function fetchJson(
  fetcher: FetchLike,
  url: string,
  timeoutMs: number,
  service: "mfds_nutrition" | "foodsafety_c002",
): Promise<unknown> {
  const controller = new AbortController();
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, timeoutMs);

  let response: Response;
  try {
    response = await fetcher(url, { signal: controller.signal });
  } catch {
    clearTimeout(timer);
    throw new PublicApiError(service, timedOut ? "timeout" : "http");
  }
  clearTimeout(timer);

  if (!response.ok) {
    throw new PublicApiError(service, "http");
  }

  try {
    return await response.json();
  } catch {
    throw new PublicApiError(service, "parse");
  }
}

const YYYYMMDD_RE = /^(\d{4})(\d{2})(\d{2})$/;

/**
 * 누락 취급 문자열(빈 문자열·'-'·'N/A', 대소문자 무관)이면 null, 아니면
 * 앞뒤 공백을 제거한 문자열을 반환한다.
 */
export function parseMissingableString(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const trimmed = raw.trim();
  if (trimmed.length === 0 || trimmed === "-" || trimmed.toUpperCase() === "N/A") {
    return null;
  }
  return trimmed;
}

/** 누락 취급 문자열이면 null, 숫자로 파싱 가능하면 number, 아니면 null. */
export function parseMissingableNumber(raw: unknown): number | null {
  if (typeof raw === "number") {
    return Number.isFinite(raw) ? raw : null;
  }
  const str = parseMissingableString(raw);
  if (str === null) return null;
  const n = Number(str);
  return Number.isFinite(n) ? n : null;
}

/**
 * 'YYYYMMDD' 형식이면 'YYYY-MM-DD'로 변환한다. 그 외 형식은 원문 그대로
 * 돌려준다(두 API 모두 날짜 필드 포맷이 공식 문서로 확인되지 않아
 * 방어적으로 처리한다 — 공식 문서 대조 필요). 누락 값은 null.
 */
export function normalizeSourceDate(raw: unknown): string | null {
  const str = parseMissingableString(raw);
  if (str === null) return null;
  const match = YYYYMMDD_RE.exec(str);
  if (match) {
    return `${match[1]}-${match[2]}-${match[3]}`;
  }
  return str;
}
