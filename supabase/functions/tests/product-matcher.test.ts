import { assertEquals } from "@std/assert";
import { pickAutomatic, rankCandidates } from "../_shared/data/product-matcher.ts";
import { normalizeName } from "../_shared/domain/normalize.ts";
import type { CachedProduct } from "../_shared/data/product-repository.ts";
import type { ScanPayload } from "../_shared/domain/types.ts";

function scan(overrides: Partial<ScanPayload> = {}): ScanPayload {
  return {
    productName: "테스트 과자",
    manufacturer: "테스트제과",
    reportNumber: null,
    ingredientsText: "밀가루, 설탕, 대두유",
    allergenStatement: null,
    crossContaminationStatement: null,
    rawText: "",
    userReviewed: true,
    ...overrides,
  };
}

function product(overrides: Partial<CachedProduct> = {}): CachedProduct {
  const name = overrides.name ?? "테스트 과자";
  const manufacturer = overrides.manufacturer ?? "테스트제과";
  return {
    id: "00000000-0000-0000-0000-000000000001",
    reportNumber: null,
    name,
    manufacturer,
    foodType: null,
    servingSize: null,
    nutrients: null,
    ingredientsText: null,
    sourceUpdatedAt: null,
    fetchedAt: new Date().toISOString(),
    normalizedName: normalizeName(name),
    normalizedManufacturer: manufacturer ? normalizeName(manufacturer) : null,
    ...overrides,
  };
}

// ---- pickAutomatic ----

Deno.test("pickAutomatic: 품목보고번호 정확 일치 후보가 있으면 report_number", () => {
  const p = product({ reportNumber: "20230012345", name: "다른 이름이어도 상관없음", manufacturer: null });
  const result = pickAutomatic(scan({ reportNumber: "20230012345" }), [p]);
  assertEquals(result?.matchType, "report_number");
  assertEquals(result?.product.id, p.id);
});

Deno.test("pickAutomatic: 번호 없음 + 이름·제조사 모두 정확 일치 후보 1개면 name_manufacturer", () => {
  const p = product();
  const result = pickAutomatic(scan(), [p]);
  assertEquals(result?.matchType, "name_manufacturer");
  assertEquals(result?.product.id, p.id);
});

Deno.test("pickAutomatic: 같은 조건 후보 2개면 null", () => {
  const a = product({ id: "a" });
  const b = product({ id: "b" });
  const result = pickAutomatic(scan(), [a, b]);
  assertEquals(result, null);
});

Deno.test("pickAutomatic: 이름만 일치(제조사 다름)면 null", () => {
  const p = product({ manufacturer: "다른회사", normalizedManufacturer: normalizeName("다른회사") });
  const result = pickAutomatic(scan(), [p]);
  assertEquals(result, null);
});

Deno.test("pickAutomatic: 유사도만 높은 근사 일치는 자동 선택하지 않는다", () => {
  // 이름이 한 글자 다른 근사 일치 — bigram Dice 유사도는 높지만 정확 일치가 아니다.
  const p = product({ name: "테스트 과자2", normalizedName: normalizeName("테스트 과자2") });
  const result = pickAutomatic(scan(), [p]);
  assertEquals(result, null);
});

Deno.test("pickAutomatic: 후보가 0개면 null", () => {
  assertEquals(pickAutomatic(scan(), []), null);
});

// ---- rankCandidates ----

Deno.test("rankCandidates: 빈 후보 목록이면 빈 배열", () => {
  assertEquals(rankCandidates(scan(), []), []);
});

Deno.test("rankCandidates: 후보 1개도 정상 동작", () => {
  const p = product();
  const result = rankCandidates(scan(), [p]);
  assertEquals(result.length, 1);
  assertEquals(result[0].id, p.id);
  if (result[0].score <= 0 || result[0].score > 1) {
    throw new Error("score는 0..1 범위여야 한다");
  }
});

Deno.test("rankCandidates: 점수 내림차순 정렬, 최대 10개", () => {
  const products: CachedProduct[] = [];
  for (let i = 0; i < 15; i++) {
    products.push(
      product({
        id: `id-${i}`,
        name: `완전히 다른 상품명 ${i}`,
        manufacturer: null,
        normalizedName: normalizeName(`완전히 다른 상품명 ${i}`),
        normalizedManufacturer: null,
      }),
    );
  }
  // 정확 일치 후보를 하나 섞는다 — 최상위 점수여야 한다.
  const exact = product({ id: "exact" });
  products.push(exact);

  const result = rankCandidates(scan(), products);
  assertEquals(result.length, 10);
  assertEquals(result[0].id, "exact");
  for (let i = 1; i < result.length; i++) {
    if (result[i - 1].score < result[i].score) {
      throw new Error("점수는 내림차순이어야 한다");
    }
  }
});

Deno.test("rankCandidates: 제조사 일치·원재료 겹침이 점수에 반영된다", () => {
  const sameMfg = product({
    id: "same-mfg",
    name: "완전 다른 이름 X",
    manufacturer: "테스트제과",
    ingredientsText: "밀가루, 설탕, 대두유",
    normalizedName: normalizeName("완전 다른 이름 X"),
    normalizedManufacturer: normalizeName("테스트제과"),
  });
  const diffMfg = product({
    id: "diff-mfg",
    name: "완전 다른 이름 X",
    manufacturer: "다른회사",
    ingredientsText: null,
    normalizedName: normalizeName("완전 다른 이름 X"),
    normalizedManufacturer: normalizeName("다른회사"),
  });

  const result = rankCandidates(scan(), [sameMfg, diffMfg]);
  const sameScore = result.find((c) => c.id === "same-mfg")!.score;
  const diffScore = result.find((c) => c.id === "diff-mfg")!.score;
  if (sameScore <= diffScore) {
    throw new Error("제조사 일치 + 원재료 겹침 후보의 점수가 더 높아야 한다");
  }
});
