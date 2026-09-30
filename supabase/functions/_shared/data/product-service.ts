// 제품 조회 서비스 (설계 8.2, 8.3). 캐시 우선 조회 → 만료/미스 시 공공 API
// 재조회·upsert → 자동 매칭/후보 순위 산출까지 오케스트레이션한다.

import { normalizeName } from "../domain/normalize.ts";
import type { DataQuality, ProductCandidate, ProductMatch, ScanPayload } from "../domain/types.ts";
import type { createFoodSafetyC002Client } from "./foodsafety-c002-client.ts";
import type { createMfdsNutritionClient } from "./mfds-nutrition-client.ts";
import { pickAutomatic, rankCandidates } from "./product-matcher.ts";
import { CACHE_TTL_MS, type CachedProduct, type ProductRepository } from "./product-repository.ts";

const NAME_SEARCH_LIMIT = 10;

export type ProductLookup = {
  product: ProductMatch | null;
  candidates: ProductCandidate[];
  productMatch: DataQuality["productMatch"];
  apiStatus: DataQuality["apiStatus"];
  /**
   * 브리프가 제안한 선택적 확장(S4에서 dataQuality.missing에 반영할 수
   * 있다) — 한쪽 공공 API만 실패해 병합 결과가 부분적일 때 true. 항상
   * boolean으로 채워 옵셔널로 인한 타입 분기를 피한다.
   */
  partialFailure: boolean;
};

function toProductMatch(cached: CachedProduct, matchType: ProductMatch["matchType"]): ProductMatch {
  return {
    id: cached.id,
    reportNumber: cached.reportNumber,
    name: cached.name,
    manufacturer: cached.manufacturer,
    foodType: cached.foodType,
    servingSize: cached.servingSize,
    nutrients: cached.nutrients,
    ingredientsText: cached.ingredientsText,
    sourceUpdatedAt: cached.sourceUpdatedAt,
    fetchedAt: cached.fetchedAt,
    matchType,
  };
}

function isFresh(product: CachedProduct, now: Date): boolean {
  const fetchedAt = new Date(product.fetchedAt).getTime();
  if (Number.isNaN(fetchedAt)) return false;
  return now.getTime() - fetchedAt < CACHE_TTL_MS;
}

/** id 기준으로 병합한다 — 나중 값(공공 API에서 새로 upsert된 값)이 우선한다. */
function mergePoolById(base: CachedProduct[], updates: CachedProduct[]): CachedProduct[] {
  const byId = new Map<string, CachedProduct>();
  for (const p of base) byId.set(p.id, p);
  for (const p of updates) byId.set(p.id, p);
  return [...byId.values()];
}

/** 후보 풀을 자동 매칭/후보 목록으로 정리한다(설계 8.2 step 5~6 공통 로직). */
function resolveFromPool(
  scan: ScanPayload,
  pool: CachedProduct[],
  apiStatus: DataQuality["apiStatus"],
  partialFailure: boolean,
): ProductLookup {
  if (pool.length === 0) {
    return { product: null, candidates: [], productMatch: "not_found", apiStatus, partialFailure };
  }

  const automatic = pickAutomatic(scan, pool);
  if (automatic) {
    return {
      product: toProductMatch(automatic.product, automatic.matchType),
      candidates: [],
      productMatch: "matched",
      apiStatus,
      partialFailure,
    };
  }

  return {
    product: null,
    candidates: rankCandidates(scan, pool),
    productMatch: "ambiguous",
    apiStatus,
    partialFailure,
  };
}

export function createProductService(deps: {
  repo: ProductRepository;
  nutrition: ReturnType<typeof createMfdsNutritionClient>;
  c002: ReturnType<typeof createFoodSafetyC002Client>;
  now?: () => Date;
}): {
  lookup(scan: ScanPayload, selectedProductId: string | null): Promise<ProductLookup>;
  search(query: string, manufacturer: string | null): Promise<ProductCandidate[]>;
} {
  const now = deps.now ?? (() => new Date());

  async function lookup(scan: ScanPayload, selectedProductId: string | null): Promise<ProductLookup> {
    if (selectedProductId) {
      const selected = await deps.repo.findById(selectedProductId);
      if (!selected) {
        return { product: null, candidates: [], productMatch: "not_found", apiStatus: "ok", partialFailure: false };
      }
      return {
        product: toProductMatch(selected, "user_selected"),
        candidates: [],
        productMatch: "matched",
        apiStatus: "ok",
        partialFailure: false,
      };
    }

    // 1단계: 로컬 캐시 — 품목보고번호 정확 일치를 우선하고, 없으면 정규화
    // 제품명으로 검색한다(설계 8.2 step 1~2).
    let localCandidates: CachedProduct[] = [];
    const scanReportNumber = scan.reportNumber?.trim();
    if (scanReportNumber) {
      const hit = await deps.repo.findByReportNumber(scanReportNumber);
      if (hit) localCandidates = [hit];
    }
    if (localCandidates.length === 0) {
      const normalizedProductName = normalizeName(scan.productName ?? "");
      if (normalizedProductName.length > 0) {
        localCandidates = await deps.repo.searchByName(normalizedProductName, NAME_SEARCH_LIMIT);
      }
    }

    const fresh = localCandidates.length > 0 && localCandidates.every((p) => isFresh(p, now()));
    if (fresh) {
      return resolveFromPool(scan, localCandidates, "ok", false);
    }

    // 2단계: 캐시 미스/만료 — 현재 요청에서 공공 API를 재조회한다(설계 8.3).
    const query = {
      name: scan.productName ?? undefined,
      reportNumber: scan.reportNumber ?? undefined,
      manufacturer: scan.manufacturer ?? undefined,
    };
    const [nutritionSettled, c002Settled] = await Promise.allSettled([
      deps.nutrition.search(query),
      deps.c002.search(query),
    ]);
    const nutritionOk = nutritionSettled.status === "fulfilled";
    const c002Ok = c002Settled.status === "fulfilled";

    if (!nutritionOk && !c002Ok) {
      if (localCandidates.length > 0) {
        return resolveFromPool(scan, localCandidates, "cache", false);
      }
      return { product: null, candidates: [], productMatch: "unavailable", apiStatus: "error", partialFailure: false };
    }

    const records = [
      ...(nutritionOk ? nutritionSettled.value : []),
      ...(c002Ok ? c002Settled.value : []),
    ];
    const refreshedPool = records.length > 0 ? await deps.repo.upsert(records) : [];
    const partialFailure = !nutritionOk || !c002Ok;

    return resolveFromPool(scan, refreshedPool, "ok", partialFailure);
  }

  async function search(query: string, manufacturer: string | null): Promise<ProductCandidate[]> {
    // 설계 8.2-3: 캐시에 없으면(또는 신선한 후보가 부족하면) 공공 API
    // 후보를 조회한다 — 스캔되지 않은 제품의 수동 검색도 캐시만으로는
    // 항상 빈 결과가 되므로, lookup()과 같은 캐시 우선 + API 보강 방식을
    // search()에도 적용한다.
    const normalizedQuery = normalizeName(query);
    const cachePool = normalizedQuery.length > 0 ? await deps.repo.searchByName(normalizedQuery, NAME_SEARCH_LIMIT) : [];
    const freshCount = cachePool.filter((p) => isFresh(p, now())).length;

    let pool = cachePool;
    if (freshCount < NAME_SEARCH_LIMIT) {
      const apiQuery = {
        name: query.length > 0 ? query : undefined,
        manufacturer: manufacturer ?? undefined,
      };
      const [nutritionSettled, c002Settled] = await Promise.allSettled([
        deps.nutrition.search(apiQuery),
        deps.c002.search(apiQuery),
      ]);
      const nutritionOk = nutritionSettled.status === "fulfilled";
      const c002Ok = c002Settled.status === "fulfilled";

      // 둘 다 실패해도 예외를 던지지 않고 캐시 결과로 진행한다(설계 8.3
      // "API 장애 시 유효 캐시를 사용하고, 캐시도 없으면 부분 결과를
      // 반환한다" — 검색 화면에서도 동일하게 적용).
      if (nutritionOk || c002Ok) {
        const records = [
          ...(nutritionOk ? nutritionSettled.value : []),
          ...(c002Ok ? c002Settled.value : []),
        ];
        if (records.length > 0) {
          const upserted = await deps.repo.upsert(records);
          pool = mergePoolById(cachePool, upserted);
        }
      }
    }

    const syntheticScan: ScanPayload = {
      productName: query,
      manufacturer,
      reportNumber: null,
      ingredientsText: "",
      allergenStatement: null,
      crossContaminationStatement: null,
      rawText: "",
      userReviewed: true,
    };
    return rankCandidates(syntheticScan, pool);
  }

  return { lookup, search };
}
