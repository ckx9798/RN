// 공공 제품 캐시 저장소 (설계 8.3). public_food_products / public_api_snapshots
// 를 다루는 유일한 모듈이다. 이 파일의 createSupabaseProductRepository는 단위
// 테스트 대상이 아니다(브리프 Step 5) — S4 통합 시 deno check로만 검증한다.
// 테스트(product-service.test.ts)는 ProductRepository 인터페이스의 인메모리
// 구현을 직접 작성해 사용한다.

import type { SupabaseClient } from "@supabase/supabase-js";
import { normalizeName } from "../domain/normalize.ts";
import type { Nutrients, ProductMatch } from "../domain/types.ts";
import type { PublicProductRecord } from "./http-client.ts";

export type CachedProduct = ProductMatch & {
  normalizedName: string;
  normalizedManufacturer: string | null;
};

export interface ProductRepository {
  findByReportNumber(reportNumber: string): Promise<CachedProduct | null>;
  findById(id: string): Promise<CachedProduct | null>;
  searchByName(normalizedName: string, limit: number): Promise<CachedProduct[]>;
  /** report_number 기준으로 레코드를 병합해 upsert하고, 레코드별 스냅샷을 저장한다. */
  upsert(records: PublicProductRecord[]): Promise<CachedProduct[]>;
}

/** 설계 8.3 "캐시 만료 또는 변경일 이후 데이터는 현재 요청에서 갱신한다". */
export const CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

type NormalizedPayload = {
  foodType: string | null;
  servingSize: string | null;
  nutrients: Nutrients | null;
  ingredientsText: string | null;
};

type ProductRow = {
  id: string;
  report_number: string | null;
  normalized_name: string;
  display_name: string;
  manufacturer: string | null;
  normalized_manufacturer: string | null;
  normalized_payload: NormalizedPayload | null;
  source_updated_at: string | null;
  fetched_at: string;
};

function rowToCachedProduct(
  row: ProductRow,
  matchType: ProductMatch["matchType"],
): CachedProduct {
  const payload = row.normalized_payload ?? {
    foodType: null,
    servingSize: null,
    nutrients: null,
    ingredientsText: null,
  };
  return {
    id: row.id,
    reportNumber: row.report_number,
    name: row.display_name,
    manufacturer: row.manufacturer,
    foodType: payload.foodType,
    servingSize: payload.servingSize,
    nutrients: payload.nutrients,
    ingredientsText: payload.ingredientsText,
    sourceUpdatedAt: row.source_updated_at,
    fetchedAt: row.fetched_at,
    matchType,
    normalizedName: row.normalized_name,
    normalizedManufacturer: row.normalized_manufacturer,
  };
}

async function sha256Hex(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/**
 * 같은 report_number를 가진 nutrition/C002 레코드를 하나의 제품 정보로
 * 병합한다. nutrients는 영양 API, ingredientsText·foodType은 C002 출처를
 * 우선한다(설계 8.3, 브리프 Step 4).
 */
function mergeGroup(group: PublicProductRecord[]): PublicProductRecord {
  const nutrition = group.find((r) => r.service === "mfds_nutrition");
  const c002 = group.find((r) => r.service === "foodsafety_c002");
  const base = nutrition ?? c002 ?? group[0];
  return {
    service: base.service,
    reportNumber: base.reportNumber,
    name: nutrition?.name || c002?.name || base.name,
    manufacturer: nutrition?.manufacturer ?? c002?.manufacturer ?? base.manufacturer,
    foodType: c002?.foodType ?? nutrition?.foodType ?? base.foodType,
    servingSize: nutrition?.servingSize ?? c002?.servingSize ?? base.servingSize,
    nutrients: nutrition?.nutrients ?? c002?.nutrients ?? base.nutrients,
    ingredientsText: c002?.ingredientsText ?? nutrition?.ingredientsText ?? base.ingredientsText,
    sourceUpdatedAt: nutrition?.sourceUpdatedAt ?? c002?.sourceUpdatedAt ?? base.sourceUpdatedAt,
    raw: base.raw,
  };
}

export function createSupabaseProductRepository(serviceClient: SupabaseClient): ProductRepository {
  return {
    async findByReportNumber(reportNumber) {
      const { data, error } = await serviceClient
        .from("public_food_products")
        .select("*")
        .eq("report_number", reportNumber)
        .maybeSingle();
      if (error || !data) return null;
      return rowToCachedProduct(data as ProductRow, "report_number");
    },

    async findById(id) {
      const { data, error } = await serviceClient
        .from("public_food_products")
        .select("*")
        .eq("id", id)
        .maybeSingle();
      if (error || !data) return null;
      return rowToCachedProduct(data as ProductRow, "user_selected");
    },

    async searchByName(normalizedNameQuery, limit) {
      const { data, error } = await serviceClient
        .from("public_food_products")
        .select("*")
        .ilike("normalized_name", `%${normalizedNameQuery}%`)
        .limit(limit);
      if (error || !data) return [];
      return (data as ProductRow[]).map((row) => rowToCachedProduct(row, "name_manufacturer"));
    },

    async upsert(records) {
      const byReportNumber = new Map<string, PublicProductRecord[]>();
      for (const rec of records) {
        // report_number가 없는 레코드는 product_food_products의 고유
        // 식별자가 없어 캐시에 저장할 수 없다 — 건너뛴다.
        if (!rec.reportNumber) continue;
        const list = byReportNumber.get(rec.reportNumber) ?? [];
        list.push(rec);
        byReportNumber.set(rec.reportNumber, list);
      }

      const results: CachedProduct[] = [];
      const fetchedAt = new Date().toISOString();

      for (const [reportNumber, group] of byReportNumber) {
        const merged = mergeGroup(group);
        const normalizedNameValue = normalizeName(merged.name);
        const normalizedManufacturerValue = merged.manufacturer
          ? normalizeName(merged.manufacturer)
          : null;
        const normalizedPayload: NormalizedPayload = {
          foodType: merged.foodType,
          servingSize: merged.servingSize,
          nutrients: merged.nutrients,
          ingredientsText: merged.ingredientsText,
        };

        const { data, error } = await serviceClient
          .from("public_food_products")
          .upsert(
            {
              report_number: reportNumber,
              normalized_name: normalizedNameValue,
              display_name: merged.name,
              manufacturer: merged.manufacturer,
              normalized_manufacturer: normalizedManufacturerValue,
              normalized_payload: normalizedPayload,
              source_updated_at: merged.sourceUpdatedAt,
              fetched_at: fetchedAt,
            },
            { onConflict: "report_number" },
          )
          .select("*")
          .single();

        if (error || !data) continue;
        const cached = rowToCachedProduct(data as ProductRow, "name_manufacturer");
        results.push(cached);

        for (const rec of group) {
          // request_fingerprint = sha-256(service + 정규화 쿼리) hex.
          // upsert()는 이미 조회된 레코드만 받으므로 원 쿼리 문자열이 없다 —
          // 레코드를 유일하게 식별하는 report_number를 정규화 쿼리로 사용한다.
          const fingerprint = await sha256Hex(`${rec.service}:${normalizeName(reportNumber)}`);
          await serviceClient.from("public_api_snapshots").insert({
            product_id: cached.id,
            service_id: rec.service,
            request_fingerprint: fingerprint,
            raw_payload: rec.raw,
            source_updated_at: rec.sourceUpdatedAt,
            fetched_at: fetchedAt,
          });
        }
      }

      return results;
    },
  };
}
