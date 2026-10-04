// 공공 제품 캐시 저장소 (설계 8.3). public_food_products / public_api_snapshots
// 를 다루는 유일한 모듈이다. 이 파일의 createSupabaseProductRepository는 단위
// 테스트 대상이 아니다(브리프 Step 5) — S4 통합 시 deno check로만 검증한다.
// 테스트(product-service.test.ts)는 ProductRepository 인터페이스의 인메모리
// 구현을 직접 작성해 사용한다.

import type { SupabaseClient } from "@supabase/supabase-js";
import { normalizeName } from "../domain/normalize.ts";
import type { Nutrients, ProductMatch } from "../domain/types.ts";
import type { PublicProductRecord } from "./http-client.ts";

// matchType은 "어떻게 자동/수동으로 선택됐는지"를 나타내는 값이라 조회
// 방식(report_number 조회, 이름 검색, upsert 등)과는 무관하다 — 저장소
// 계층에서는 의미가 없으므로 CachedProduct에는 넣지 않는다. 실제 matchType은
// product-service.ts가 pickAutomatic/사용자 선택 결과를 바탕으로 채운다
// (toProductMatch 참고).
export type CachedProduct = Omit<ProductMatch, "matchType"> & {
  normalizedName: string;
  normalizedManufacturer: string | null;
};

export interface ProductRepository {
  findByReportNumber(reportNumber: string): Promise<CachedProduct | null>;
  findById(id: string): Promise<CachedProduct | null>;
  searchByName(normalizedName: string, limit: number): Promise<CachedProduct[]>;
  /**
   * report_number가 있는 레코드는 report_number 기준으로, 없는 레코드는
   * (정규화 이름, 정규화 제조사) 조합 기준으로 병합해 upsert하고, 레코드별
   * 스냅샷을 저장한다. report_number가 없다고 버리지 않는다 — 그래야 같은
   * 요청 안에서 후보로 남고, 사용자가 `selectedProductId`로 나중에 다시
   * 조회할 수 있다.
   *
   * S4 참고 — `public_api_snapshots.request_fingerprint` 의미가
   * 브리프 원문("sha-256(service + 정규화 쿼리)")에서 한 단계 달라졌다.
   * `upsert()`는 이미 조회된 결과 레코드만 받고 원 요청 쿼리 문자열을
   * 갖고 있지 않으므로, 레코드를 유일하게 식별하는 값(report_number,
   * 또는 그것이 없으면 정규화 이름+제조사 조합)을 "정규화 쿼리" 대용으로
   * 사용해 fingerprint를 계산한다. 즉 fingerprint는 "이 API를 어떤
   * 쿼리로 호출했는가"가 아니라 "이 API가 어떤 제품을 반환했는가"를
   * 가리킨다 — 캐시 중복 갱신 감지·감사 목적에는 동일하게 쓸 수 있지만,
   * 원래 사용자가 입력한 검색어를 복원하는 용도로는 쓸 수 없다.
   */
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

function rowToCachedProduct(row: ProductRow): CachedProduct {
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
    normalizedName: row.normalized_name,
    normalizedManufacturer: row.normalized_manufacturer,
  };
}

const UNIQUE_VIOLATION = "23505";

/**
 * report_number가 없는 행은 (normalized_name, coalesce(normalized_manufacturer,''))
 * 부분 유니크 인덱스(마이그레이션 20260930000500_product_name_unique.sql)로
 * DB가 동시 삽입을 막는다. "먼저 조회해서 없으면 삽입"은 두 요청이 동시에
 * 들어오면 레이스가 생기므로, 대신 먼저 삽입을 시도하고 유니크 위반
 * (23505)이 나면 그제서야 기존 행을 다시 조회해 갱신한다(insert-then-recover
 * — 조회와 삽입 사이에 레이스가 없다). 그 외 에러는 삼키지 않고 그대로
 * 던진다 — 호출자(product-service.ts)가 공공 API 실패와 동일하게 캐시
 * 폴백으로 처리한다.
 */
async function upsertByNameManufacturer(
  serviceClient: SupabaseClient,
  normalizedNameValue: string,
  normalizedManufacturerValue: string | null,
  rowPayload: {
    normalized_name: string;
    display_name: string;
    manufacturer: string | null;
    normalized_manufacturer: string | null;
    normalized_payload: NormalizedPayload;
    source_updated_at: string | null;
    fetched_at: string;
  },
): Promise<CachedProduct> {
  const inserted = await serviceClient
    .from("public_food_products")
    .insert({ report_number: null, ...rowPayload })
    .select("*")
    .single();

  if (!inserted.error) {
    return rowToCachedProduct(inserted.data as ProductRow);
  }
  if (inserted.error.code !== UNIQUE_VIOLATION) {
    throw inserted.error;
  }

  // 유니크 위반 — 동시 요청이 먼저 같은 조합을 삽입했다. 그 행을 찾아 갱신한다.
  let existingQuery = serviceClient
    .from("public_food_products")
    .select("*")
    .is("report_number", null)
    .eq("normalized_name", normalizedNameValue);
  existingQuery = normalizedManufacturerValue
    ? existingQuery.eq("normalized_manufacturer", normalizedManufacturerValue)
    : existingQuery.is("normalized_manufacturer", null);

  const { data: existingRow, error: selectError } = await existingQuery.maybeSingle();
  if (selectError) {
    throw selectError;
  }
  if (!existingRow) {
    // 유니크 위반이 났는데 조회가 안 되는 건 비정상 상태 — 원래 삽입
    // 에러를 그대로 드러낸다(새 에러로 가리지 않는다).
    throw inserted.error;
  }

  const { data: updated, error: updateError } = await serviceClient
    .from("public_food_products")
    .update(rowPayload)
    .eq("id", (existingRow as ProductRow).id)
    .select("*")
    .single();
  if (updateError) {
    throw updateError;
  }
  return rowToCachedProduct(updated as ProductRow);
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
      return rowToCachedProduct(data as ProductRow);
    },

    async findById(id) {
      const { data, error } = await serviceClient
        .from("public_food_products")
        .select("*")
        .eq("id", id)
        .maybeSingle();
      if (error || !data) return null;
      return rowToCachedProduct(data as ProductRow);
    },

    async searchByName(normalizedNameQuery, limit) {
      const { data, error } = await serviceClient
        .from("public_food_products")
        .select("*")
        .ilike("normalized_name", `%${normalizedNameQuery}%`)
        .limit(limit);
      if (error || !data) return [];
      return (data as ProductRow[]).map((row) => rowToCachedProduct(row));
    },

    async upsert(records) {
      // report_number가 있으면 그것으로, 없으면 (정규화 이름, 정규화
      // 제조사) 조합으로 레코드를 묶는다 — report_number가 없는 레코드도
      // 더 이상 버리지 않는다(같은 요청 안에서 후보로 남고, 사용자가
      // selectedProductId로 나중에 다시 찾을 수 있어야 하므로 실제 행으로
      // 영속화한다).
      const reportGroups = new Map<string, PublicProductRecord[]>();
      const nameGroups = new Map<
        string,
        { normalizedName: string; normalizedManufacturer: string | null; records: PublicProductRecord[] }
      >();

      for (const rec of records) {
        if (rec.reportNumber) {
          const list = reportGroups.get(rec.reportNumber) ?? [];
          list.push(rec);
          reportGroups.set(rec.reportNumber, list);
          continue;
        }
        const normalizedNameValue = normalizeName(rec.name);
        const normalizedManufacturerValue = rec.manufacturer ? normalizeName(rec.manufacturer) : null;
        const key = `${normalizedNameValue}::${normalizedManufacturerValue ?? ""}`;
        const existing = nameGroups.get(key);
        if (existing) {
          existing.records.push(rec);
        } else {
          nameGroups.set(key, {
            normalizedName: normalizedNameValue,
            normalizedManufacturer: normalizedManufacturerValue,
            records: [rec],
          });
        }
      }

      const results: CachedProduct[] = [];
      const fetchedAt = new Date().toISOString();

      for (const [reportNumber, group] of reportGroups) {
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
        const cached = rowToCachedProduct(data as ProductRow);
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

      for (const { normalizedName: normalizedNameValue, normalizedManufacturer: normalizedManufacturerValue, records: group } of nameGroups.values()) {
        const merged = mergeGroup(group);
        const normalizedPayload: NormalizedPayload = {
          foodType: merged.foodType,
          servingSize: merged.servingSize,
          nutrients: merged.nutrients,
          ingredientsText: merged.ingredientsText,
        };
        const rowPayload = {
          normalized_name: normalizedNameValue,
          display_name: merged.name,
          manufacturer: merged.manufacturer,
          normalized_manufacturer: normalizedManufacturerValue,
          normalized_payload: normalizedPayload,
          source_updated_at: merged.sourceUpdatedAt,
          fetched_at: fetchedAt,
        };

        // insert-then-recover(upsertByNameManufacturer)로 동시 요청 간
        // 레이스 없이 처리한다. 에러는 삼키지 않고 던진다 — product-service.ts가
        // 공공 API 실패와 동일하게 캐시 폴백으로 처리한다.
        const cached = await upsertByNameManufacturer(
          serviceClient,
          normalizedNameValue,
          normalizedManufacturerValue,
          rowPayload,
        );
        results.push(cached);

        for (const rec of group) {
          const fingerprint = await sha256Hex(
            `${rec.service}:${normalizedNameValue}::${normalizedManufacturerValue ?? ""}`,
          );
          const { error: snapshotError } = await serviceClient.from("public_api_snapshots").insert({
            product_id: cached.id,
            service_id: rec.service,
            request_fingerprint: fingerprint,
            raw_payload: rec.raw,
            source_updated_at: rec.sourceUpdatedAt,
            fetched_at: fetchedAt,
          });
          if (snapshotError) {
            throw snapshotError;
          }
        }
      }

      return results;
    },
  };
}
