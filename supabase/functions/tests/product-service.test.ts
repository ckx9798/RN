import { assertEquals } from "@std/assert";
import { createProductService } from "../_shared/data/product-service.ts";
import { CACHE_TTL_MS, type CachedProduct, type ProductRepository } from "../_shared/data/product-repository.ts";
import { PublicApiError } from "../_shared/data/http-client.ts";
import { normalizeName } from "../_shared/domain/normalize.ts";
import type { PublicProductRecord } from "../_shared/data/http-client.ts";
import type { ScanPayload } from "../_shared/domain/types.ts";

function scan(overrides: Partial<ScanPayload> = {}): ScanPayload {
  return {
    productName: "테스트 과자",
    manufacturer: "테스트제과",
    reportNumber: "20230012345",
    ingredientsText: "밀가루, 설탕, 대두유",
    allergenStatement: null,
    crossContaminationStatement: null,
    rawText: "",
    userReviewed: true,
    ...overrides,
  };
}

function cachedProduct(overrides: Partial<CachedProduct> = {}): CachedProduct {
  const name = overrides.name ?? "테스트 과자";
  const manufacturer = overrides.manufacturer ?? "테스트제과";
  return {
    id: "00000000-0000-0000-0000-000000000001",
    reportNumber: "20230012345",
    name,
    manufacturer,
    foodType: "과자",
    servingSize: "30g",
    nutrients: { energy: { value: 150, unit: "kcal" } },
    ingredientsText: "밀가루, 설탕, 대두유",
    sourceUpdatedAt: "2024-01-01",
    fetchedAt: new Date().toISOString(),
    matchType: "report_number",
    normalizedName: normalizeName(name),
    normalizedManufacturer: manufacturer ? normalizeName(manufacturer) : null,
    ...overrides,
  };
}

/** 인메모리 ProductRepository — report_number 기준 upsert만 지원하면 충분하다. */
function createInMemoryRepository(seed: CachedProduct[] = []): ProductRepository & { products: CachedProduct[] } {
  const products = [...seed];
  let nextId = 1000;

  const repo: ProductRepository & { products: CachedProduct[] } = {
    products,
    findByReportNumber(reportNumber) {
      return Promise.resolve(products.find((p) => p.reportNumber === reportNumber) ?? null);
    },
    findById(id) {
      return Promise.resolve(products.find((p) => p.id === id) ?? null);
    },
    searchByName(normalizedNameQuery, limit) {
      return Promise.resolve(
        products.filter((p) => p.normalizedName.includes(normalizedNameQuery)).slice(0, limit),
      );
    },
    upsert(records) {
      const byReportNumber = new Map<string, PublicProductRecord[]>();
      for (const rec of records) {
        if (!rec.reportNumber) continue;
        const list = byReportNumber.get(rec.reportNumber) ?? [];
        list.push(rec);
        byReportNumber.set(rec.reportNumber, list);
      }

      const result: CachedProduct[] = [];
      for (const [reportNumber, group] of byReportNumber) {
        const nutrition = group.find((r) => r.service === "mfds_nutrition");
        const c002 = group.find((r) => r.service === "foodsafety_c002");
        const base = nutrition ?? c002 ?? group[0];
        const name = nutrition?.name || c002?.name || base.name;
        const manufacturer = nutrition?.manufacturer ?? c002?.manufacturer ?? base.manufacturer;

        const existingIndex = products.findIndex((p) => p.reportNumber === reportNumber);
        const merged: CachedProduct = {
          id: existingIndex >= 0 ? products[existingIndex].id : `generated-${nextId++}`,
          reportNumber,
          name,
          manufacturer,
          foodType: c002?.foodType ?? nutrition?.foodType ?? base.foodType,
          servingSize: nutrition?.servingSize ?? c002?.servingSize ?? base.servingSize,
          nutrients: nutrition?.nutrients ?? c002?.nutrients ?? base.nutrients,
          ingredientsText: c002?.ingredientsText ?? nutrition?.ingredientsText ?? base.ingredientsText,
          sourceUpdatedAt: nutrition?.sourceUpdatedAt ?? c002?.sourceUpdatedAt ?? base.sourceUpdatedAt,
          fetchedAt: new Date().toISOString(),
          matchType: "name_manufacturer",
          normalizedName: normalizeName(name),
          normalizedManufacturer: manufacturer ? normalizeName(manufacturer) : null,
        };

        if (existingIndex >= 0) {
          products[existingIndex] = merged;
        } else {
          products.push(merged);
        }
        result.push(merged);
      }
      return Promise.resolve(result);
    },
  };
  return repo;
}

function okNutritionClient(records: PublicProductRecord[]) {
  return { search: (_q: unknown) => Promise.resolve(records) };
}
function okC002Client(records: PublicProductRecord[]) {
  return { search: (_q: unknown) => Promise.resolve(records) };
}
function failingClient(service: "mfds_nutrition" | "foodsafety_c002") {
  return { search: (_q: unknown) => Promise.reject(new PublicApiError(service, "http")) };
}

function nutritionRecord(overrides: Partial<PublicProductRecord> = {}): PublicProductRecord {
  return {
    service: "mfds_nutrition",
    reportNumber: "20230012345",
    name: "테스트 과자",
    manufacturer: "테스트제과",
    foodType: "과자",
    servingSize: "30g",
    nutrients: { energy: { value: 150, unit: "kcal" } },
    ingredientsText: null,
    sourceUpdatedAt: "2024-02-01",
    raw: {},
    ...overrides,
  };
}
function c002Record(overrides: Partial<PublicProductRecord> = {}): PublicProductRecord {
  return {
    service: "foodsafety_c002",
    reportNumber: "20230012345",
    name: "테스트 과자",
    manufacturer: "테스트제과",
    foodType: "과자",
    servingSize: null,
    nutrients: null,
    ingredientsText: "밀가루, 설탕, 대두유",
    sourceUpdatedAt: "2024-02-01",
    raw: {},
    ...overrides,
  };
}

// deno-lint-ignore no-explicit-any
type AnyClient = any;

Deno.test("lookup: selectedProductId가 주어지고 repo에 있으면 user_selected로 matched", async () => {
  const repo = createInMemoryRepository([cachedProduct()]);
  const service = createProductService({
    repo,
    nutrition: okNutritionClient([]) as AnyClient,
    c002: okC002Client([]) as AnyClient,
  });

  const result = await service.lookup(scan(), "00000000-0000-0000-0000-000000000001");
  assertEquals(result.productMatch, "matched");
  assertEquals(result.product?.matchType, "user_selected");
  assertEquals(result.candidates, []);
});

Deno.test("lookup: selectedProductId가 repo에 없으면 not_found", async () => {
  const repo = createInMemoryRepository([]);
  const service = createProductService({
    repo,
    nutrition: okNutritionClient([]) as AnyClient,
    c002: okC002Client([]) as AnyClient,
  });

  const result = await service.lookup(scan(), "no-such-id");
  assertEquals(result.productMatch, "not_found");
  assertEquals(result.product, null);
});

Deno.test("lookup: 캐시 hit(만료 전)이면 외부 API를 호출하지 않고 apiStatus ok", async () => {
  const fresh = cachedProduct({ fetchedAt: new Date().toISOString() });
  const repo = createInMemoryRepository([fresh]);
  let nutritionCalled = false;
  let c002Called = false;
  const service = createProductService({
    repo,
    nutrition: { search: (_q: unknown) => { nutritionCalled = true; return Promise.resolve([]); } } as AnyClient,
    c002: { search: (_q: unknown) => { c002Called = true; return Promise.resolve([]); } } as AnyClient,
  });

  const result = await service.lookup(scan(), null);
  assertEquals(nutritionCalled, false);
  assertEquals(c002Called, false);
  assertEquals(result.apiStatus, "ok");
  assertEquals(result.productMatch, "matched");
});

Deno.test("lookup: 캐시 만료면 현재 요청에서 API 재조회 후 upsert, apiStatus ok", async () => {
  const stale = cachedProduct({ fetchedAt: new Date(Date.now() - CACHE_TTL_MS - 1000).toISOString() });
  const repo = createInMemoryRepository([stale]);
  const freshNutrition = nutritionRecord({ nutrients: { energy: { value: 999, unit: "kcal" } } });
  const service = createProductService({
    repo,
    nutrition: okNutritionClient([freshNutrition]) as AnyClient,
    c002: okC002Client([c002Record()]) as AnyClient,
  });

  const result = await service.lookup(scan(), null);
  assertEquals(result.apiStatus, "ok");
  assertEquals(result.product?.nutrients?.energy?.value, 999);
});

Deno.test("lookup: API 오류 + 유효 캐시 있으면 캐시 사용, apiStatus cache", async () => {
  const fresh = cachedProduct({ fetchedAt: new Date(Date.now() - CACHE_TTL_MS - 1000).toISOString() });
  const repo = createInMemoryRepository([fresh]);
  const service = createProductService({
    repo,
    nutrition: failingClient("mfds_nutrition") as AnyClient,
    c002: failingClient("foodsafety_c002") as AnyClient,
  });

  const result = await service.lookup(scan(), null);
  assertEquals(result.apiStatus, "cache");
  assertEquals(result.productMatch, "matched");
});

Deno.test("lookup: API 오류 + 캐시 없으면 product null, productMatch unavailable, apiStatus error", async () => {
  const repo = createInMemoryRepository([]);
  const service = createProductService({
    repo,
    nutrition: failingClient("mfds_nutrition") as AnyClient,
    c002: failingClient("foodsafety_c002") as AnyClient,
  });

  const result = await service.lookup(scan(), null);
  assertEquals(result.apiStatus, "error");
  assertEquals(result.productMatch, "unavailable");
  assertEquals(result.product, null);
  assertEquals(result.candidates, []);
});

Deno.test("lookup: 후보 0개면 not_found", async () => {
  const repo = createInMemoryRepository([]);
  const service = createProductService({
    repo,
    nutrition: okNutritionClient([]) as AnyClient,
    c002: okC002Client([]) as AnyClient,
  });

  const result = await service.lookup(scan(), null);
  assertEquals(result.productMatch, "not_found");
  assertEquals(result.product, null);
});

Deno.test("lookup: 자동 선택 조건 불충족(제조사 다름)이면 ambiguous + candidates", async () => {
  const repo = createInMemoryRepository([]);
  const mismatched = nutritionRecord({ manufacturer: "다른회사" });
  const service = createProductService({
    repo,
    nutrition: okNutritionClient([mismatched]) as AnyClient,
    c002: okC002Client([]) as AnyClient,
  });

  const result = await service.lookup(scan({ reportNumber: null }), null);
  assertEquals(result.productMatch, "ambiguous");
  assertEquals(result.product, null);
  if (result.candidates.length === 0) throw new Error("candidates가 비어 있으면 안 된다");
});

Deno.test("lookup: 복수 후보면 ambiguous + candidates", async () => {
  const repo = createInMemoryRepository([]);
  const a = nutritionRecord({ reportNumber: "111", manufacturer: "테스트제과" });
  const b = nutritionRecord({ reportNumber: "222", manufacturer: "테스트제과" });
  const service = createProductService({
    repo,
    nutrition: okNutritionClient([a, b]) as AnyClient,
    c002: okC002Client([]) as AnyClient,
  });

  const result = await service.lookup(scan({ reportNumber: null }), null);
  assertEquals(result.productMatch, "ambiguous");
  assertEquals(result.candidates.length, 2);
});

Deno.test("lookup: 영양(nutrition)과 C002 결과는 reportNumber가 같으면 한 제품으로 병합된다", async () => {
  const repo = createInMemoryRepository([]);
  const service = createProductService({
    repo,
    nutrition: okNutritionClient([nutritionRecord()]) as AnyClient,
    c002: okC002Client([c002Record()]) as AnyClient,
  });

  const result = await service.lookup(scan(), null);
  assertEquals(result.productMatch, "matched");
  assertEquals(result.product?.nutrients?.energy?.value, 150); // nutrition 출처
  assertEquals(result.product?.ingredientsText, "밀가루, 설탕, 대두유"); // C002 출처
});

Deno.test("lookup: 한쪽 API만 실패해도 다른 쪽 데이터로 진행하고 apiStatus는 ok", async () => {
  const repo = createInMemoryRepository([]);
  const service = createProductService({
    repo,
    nutrition: okNutritionClient([nutritionRecord()]) as AnyClient,
    c002: failingClient("foodsafety_c002") as AnyClient,
  });

  const result = await service.lookup(scan(), null);
  assertEquals(result.apiStatus, "ok");
  assertEquals(result.partialFailure, true);
  assertEquals(result.productMatch, "matched");
});

Deno.test("search: 이름으로 캐시를 검색해 순위 매긴 후보를 반환한다", async () => {
  const repo = createInMemoryRepository([cachedProduct()]);
  const service = createProductService({
    repo,
    nutrition: okNutritionClient([]) as AnyClient,
    c002: okC002Client([]) as AnyClient,
  });

  const result = await service.search("테스트 과자", "테스트제과");
  assertEquals(result.length, 1);
  assertEquals(result[0].name, "테스트 과자");
});
