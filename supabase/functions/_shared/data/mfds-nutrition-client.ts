// 식품의약품안전처 식품영양성분 DB 정보 오픈API 클라이언트 (설계 8.1-1).
//
// 공식 문서 대조 필요: data.go.kr 문서 페이지(15127578)는 JS 렌더링/접근
// 제한으로 정확한 응답 필드명을 WebFetch로 확인하지 못했다. 브리프가 제시한
// 기본 엔드포인트·필드 매핑을 FIELD_MAP 한 곳에 모아 사용한다. 실제 연동 전
// 공식 문서(또는 data.go.kr 미리보기 응답)로 재검증이 필요하다.

import {
  fetchJson,
  normalizeSourceDate,
  parseMissingableNumber,
  parseMissingableString,
  PublicApiError,
  type FetchLike,
  type PublicProductRecord,
} from "./http-client.ts";
import type { Nutrients, NutrientKey } from "../domain/types.ts";

const SERVICE = "mfds_nutrition" as const;
const DEFAULT_TIMEOUT_MS = 5000;
const BASE_URL =
  "https://apis.data.go.kr/1471000/FoodNtrCpntDbInfo02/getFoodNtrCpntDbInq02";

type NutrientFieldSpec = { field: string; unit: "kcal" | "g" | "mg" };

// 공식 문서 대조 필요 (위 주석 참고).
export const FIELD_MAP = {
  name: "FOOD_NM_KR",
  manufacturer: "MAKER_NM",
  reportNumber: "ITEM_REPORT_NO",
  foodType: "FOOD_CAT1_NM",
  servingSize: "SERVING_SIZE",
  sourceUpdatedAt: "UPDATE_DATE",
  nutrients: {
    energy: { field: "AMT_NUM1", unit: "kcal" },
    protein: { field: "AMT_NUM3", unit: "g" },
    fat: { field: "AMT_NUM4", unit: "g" },
    carbohydrate: { field: "AMT_NUM6", unit: "g" },
    sugars: { field: "AMT_NUM7", unit: "g" },
    calcium: { field: "AMT_NUM9", unit: "mg" },
    phosphorus: { field: "AMT_NUM11", unit: "mg" },
    potassium: { field: "AMT_NUM12", unit: "mg" },
    sodium: { field: "AMT_NUM13", unit: "mg" },
    saturated_fat: { field: "AMT_NUM24", unit: "g" },
    cholesterol: { field: "AMT_NUM23", unit: "mg" },
  } satisfies Record<string, NutrientFieldSpec>,
} as const;

type RawItem = Record<string, unknown>;

/**
 * `{ response: { body: { items: [...] } } }` 형태를 기본으로 하되,
 * data.go.kr류 API가 흔히 쓰는 `{ items: { item: [...] } }`(단건일 때는
 * 배열이 아닌 객체)도 방어적으로 허용한다 — 공식 문서 대조 필요.
 */
function extractItems(payload: unknown): RawItem[] {
  if (!payload || typeof payload !== "object") return [];
  const response = (payload as Record<string, unknown>).response;
  if (!response || typeof response !== "object") return [];
  const body = (response as Record<string, unknown>).body;
  if (!body || typeof body !== "object") return [];
  const items = (body as Record<string, unknown>).items;
  if (Array.isArray(items)) return items as RawItem[];
  if (items && typeof items === "object") {
    const item = (items as Record<string, unknown>).item;
    if (Array.isArray(item)) return item as RawItem[];
    if (item && typeof item === "object") return [item as RawItem];
  }
  return [];
}

function buildNutrients(item: RawItem): Nutrients | null {
  const nutrients: Nutrients = {};
  for (const [key, spec] of Object.entries(FIELD_MAP.nutrients)) {
    const value = parseMissingableNumber(item[spec.field]);
    if (value !== null) {
      nutrients[key as NutrientKey] = { value, unit: spec.unit };
    }
  }
  return Object.keys(nutrients).length > 0 ? nutrients : null;
}

function toProductRecord(item: RawItem): PublicProductRecord {
  return {
    service: SERVICE,
    reportNumber: parseMissingableString(item[FIELD_MAP.reportNumber]),
    name: parseMissingableString(item[FIELD_MAP.name]) ?? "",
    manufacturer: parseMissingableString(item[FIELD_MAP.manufacturer]),
    foodType: parseMissingableString(item[FIELD_MAP.foodType]),
    servingSize: parseMissingableString(item[FIELD_MAP.servingSize]),
    nutrients: buildNutrients(item),
    ingredientsText: null,
    sourceUpdatedAt: normalizeSourceDate(item[FIELD_MAP.sourceUpdatedAt]),
    raw: item,
  };
}

export function createMfdsNutritionClient(opts: {
  serviceKey: string;
  fetcher?: FetchLike;
  timeoutMs?: number;
}): {
  search(q: { name?: string; reportNumber?: string; manufacturer?: string }): Promise<PublicProductRecord[]>;
} {
  const fetcher = opts.fetcher ?? fetch;
  const timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS;

  return {
    async search(q) {
      if (!opts.serviceKey || opts.serviceKey.trim().length === 0) {
        throw new PublicApiError(SERVICE, "config");
      }

      const params = new URLSearchParams({
        serviceKey: opts.serviceKey,
        pageNo: "1",
        numOfRows: "20",
        type: "json",
        FOOD_NM_KR: q.name ?? "",
        ITEM_REPORT_NO: q.reportNumber ?? "",
        MAKER_NM: q.manufacturer ?? "",
      });
      const url = `${BASE_URL}?${params.toString()}`;

      const payload = await fetchJson(fetcher, url, timeoutMs, SERVICE);
      return extractItems(payload).map(toProductRecord);
    },
  };
}
