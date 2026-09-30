// 식품안전나라 식품(첨가물) 품목제조보고 원재료 오픈API(C002) 클라이언트
// (설계 8.1-2).
//
// 공식 문서 대조 필요: foodsafetykorea.go.kr 문서 페이지는 WebFetch로
// 상세 응답 스키마(필드별 정확한 표기)를 확인하지 못했다. 브리프가 제시한
// 기본 엔드포인트·필드 매핑을 FIELD_MAP 한 곳에 모아 사용한다. 실제 연동 전
// 공식 문서(또는 실응답 샘플)로 재검증이 필요하다.

import {
  fetchJson,
  normalizeSourceDate,
  parseMissingableString,
  PublicApiError,
  type FetchLike,
  type PublicProductRecord,
} from "./http-client.ts";

const SERVICE = "foodsafety_c002" as const;
const DEFAULT_TIMEOUT_MS = 5000;
const BASE_URL = "https://openapi.foodsafetykorea.go.kr/api";
const SERVICE_ID = "C002";
const NO_DATA_CODE = "INFO-200";
const SUCCESS_CODE = "INFO-000";

// 공식 문서 대조 필요 (위 주석 참고).
export const FIELD_MAP = {
  reportNumber: "PRDLST_REPORT_NO",
  name: "PRDLST_NM",
  manufacturer: "BSSH_NM",
  foodType: "PRDLST_DCNM",
  ingredientsText: "RAWMTRL_NM",
  sourceUpdatedAt: "CHNG_DT",
} as const;

type RawItem = Record<string, unknown>;

function buildUrl(apiKey: string, q: { name?: string; reportNumber?: string; manufacturer?: string }): string {
  const segments: string[] = [];
  if (q.reportNumber) {
    segments.push(`PRDLST_REPORT_NO=${encodeURIComponent(q.reportNumber)}`);
  }
  if (q.name) {
    segments.push(`PRDLST_NM=${encodeURIComponent(q.name)}`);
  }
  if (q.manufacturer) {
    segments.push(`BSSH_NM=${encodeURIComponent(q.manufacturer)}`);
  }
  const query = segments.length > 0 ? `/${segments.join("/")}` : "";
  return `${BASE_URL}/${encodeURIComponent(apiKey)}/${SERVICE_ID}/json/1/20${query}`;
}

/** C002.RESULT.CODE를 확인해 INFO-200은 빈 배열, 그 외 실패 코드는 에러로 던진다. */
function extractRows(payload: unknown): RawItem[] {
  if (!payload || typeof payload !== "object") {
    throw new PublicApiError(SERVICE, "parse");
  }
  const envelope = (payload as Record<string, unknown>)[SERVICE_ID];
  if (!envelope || typeof envelope !== "object") {
    throw new PublicApiError(SERVICE, "parse");
  }
  const result = (envelope as Record<string, unknown>).RESULT;
  const code = result && typeof result === "object" ? (result as Record<string, unknown>).CODE : undefined;

  if (code === NO_DATA_CODE) return [];
  if (code !== SUCCESS_CODE) {
    throw new PublicApiError(SERVICE, "http");
  }

  const row = (envelope as Record<string, unknown>).row;
  return Array.isArray(row) ? (row as RawItem[]) : [];
}

function toProductRecord(item: RawItem): PublicProductRecord {
  return {
    service: SERVICE,
    reportNumber: parseMissingableString(item[FIELD_MAP.reportNumber]),
    name: parseMissingableString(item[FIELD_MAP.name]) ?? "",
    manufacturer: parseMissingableString(item[FIELD_MAP.manufacturer]),
    foodType: parseMissingableString(item[FIELD_MAP.foodType]),
    servingSize: null,
    nutrients: null,
    ingredientsText: parseMissingableString(item[FIELD_MAP.ingredientsText]),
    sourceUpdatedAt: normalizeSourceDate(item[FIELD_MAP.sourceUpdatedAt]),
    raw: item,
  };
}

export function createFoodSafetyC002Client(opts: {
  apiKey: string;
  fetcher?: FetchLike;
  timeoutMs?: number;
}): {
  search(q: { name?: string; reportNumber?: string; manufacturer?: string }): Promise<PublicProductRecord[]>;
} {
  const fetcher = opts.fetcher ?? fetch;
  const timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS;

  return {
    async search(q) {
      if (!opts.apiKey || opts.apiKey.trim().length === 0) {
        throw new PublicApiError(SERVICE, "config");
      }

      const url = buildUrl(opts.apiKey, q);
      const payload = await fetchJson(fetcher, url, timeoutMs, SERVICE);
      return extractRows(payload).map(toProductRecord);
    },
  };
}
