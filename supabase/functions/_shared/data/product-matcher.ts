// 제품 후보 순위·자동 매칭 (설계 8.2).
//   - pickAutomatic: 품목보고번호 정확 일치, 또는 정규화 이름·제조사가
//     모두 정확히 일치하는 유일한 후보만 자동 선택한다. 유사도만으로는
//     자동 선택하지 않는다(설계 8.2-5).
//   - rankCandidates: 사용자에게 보여줄 후보 순서만 계산한다.

import { flattenAtoms, parseIngredients } from "../domain/ingredient-parser.ts";
import { normalizeName } from "../domain/normalize.ts";
import type { ProductCandidate, ScanPayload } from "../domain/types.ts";
import type { CachedProduct } from "./product-repository.ts";

const NAME_WEIGHT = 0.6;
const MANUFACTURER_WEIGHT = 0.25;
const INGREDIENT_WEIGHT = 0.15;
const MAX_CANDIDATES = 10;

function bigrams(s: string): string[] {
  if (s.length < 2) return [];
  const grams: string[] = [];
  for (let i = 0; i < s.length - 1; i += 1) {
    grams.push(s.slice(i, i + 2));
  }
  return grams;
}

/** bigram Dice 계수. 둘 다 빈 문자열이면 1, 한쪽만 비었으면 0. */
function diceCoefficient(a: string, b: string): number {
  if (a.length === 0 && b.length === 0) return 1;
  if (a.length === 0 || b.length === 0) return 0;

  const bigramsA = bigrams(a);
  const bigramsB = bigrams(b);
  if (bigramsA.length === 0 || bigramsB.length === 0) {
    return a === b ? 1 : 0;
  }

  const counts = new Map<string, number>();
  for (const g of bigramsA) counts.set(g, (counts.get(g) ?? 0) + 1);

  let matches = 0;
  for (const g of bigramsB) {
    const remaining = counts.get(g) ?? 0;
    if (remaining > 0) {
      matches += 1;
      counts.set(g, remaining - 1);
    }
  }

  return (2 * matches) / (bigramsA.length + bigramsB.length);
}

/** 원재료 토큰 Jaccard 유사도. 제품 쪽 원재료 텍스트가 없으면 0. */
function ingredientJaccard(scanIngredientsText: string, productIngredientsText: string | null): number {
  if (!productIngredientsText || productIngredientsText.trim().length === 0) return 0;

  const scanAtoms = new Set(flattenAtoms(parseIngredients(scanIngredientsText)));
  const productAtoms = new Set(flattenAtoms(parseIngredients(productIngredientsText)));
  if (scanAtoms.size === 0 || productAtoms.size === 0) return 0;

  let intersection = 0;
  for (const atom of scanAtoms) {
    if (productAtoms.has(atom)) intersection += 1;
  }
  const union = scanAtoms.size + productAtoms.size - intersection;
  return union === 0 ? 0 : intersection / union;
}

function clamp01(n: number): number {
  return Math.max(0, Math.min(1, n));
}

function scoreProduct(
  scanNormalizedName: string,
  scanNormalizedManufacturer: string | null,
  scan: ScanPayload,
  product: CachedProduct,
): number {
  const nameSim = diceCoefficient(scanNormalizedName, product.normalizedName);
  const manufacturerMatch =
    scanNormalizedManufacturer !== null &&
    product.normalizedManufacturer !== null &&
    scanNormalizedManufacturer === product.normalizedManufacturer
      ? 1
      : 0;
  const ingredientSim = ingredientJaccard(scan.ingredientsText, product.ingredientsText);

  return clamp01(
    NAME_WEIGHT * nameSim + MANUFACTURER_WEIGHT * manufacturerMatch + INGREDIENT_WEIGHT * ingredientSim,
  );
}

/** 점수 내림차순, 최대 10개. 사용자에게 보여줄 순서에만 쓴다(자동 선택 금지). */
export function rankCandidates(scan: ScanPayload, products: CachedProduct[]): ProductCandidate[] {
  const scanNormalizedName = normalizeName(scan.productName ?? "");
  const scanNormalizedManufacturer = scan.manufacturer ? normalizeName(scan.manufacturer) : null;

  const scored: ProductCandidate[] = products.map((p) => ({
    id: p.id,
    reportNumber: p.reportNumber,
    name: p.name,
    manufacturer: p.manufacturer,
    score: scoreProduct(scanNormalizedName, scanNormalizedManufacturer, scan, p),
  }));

  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, MAX_CANDIDATES);
}

/**
 * 품목보고번호 정확 일치, 또는 정규화 제품명·제조사가 모두 정확히 일치하는
 * 유일한 후보만 자동 선택한다. 그 외(복수 후보, 근사 일치만 있는 경우 등)는
 * null — 웹에서 사용자가 후보를 선택한다(설계 8.2-6).
 */
export function pickAutomatic(
  scan: ScanPayload,
  products: CachedProduct[],
): { product: CachedProduct; matchType: "report_number" | "name_manufacturer" } | null {
  const scanReportNumber = scan.reportNumber?.trim();
  if (scanReportNumber) {
    const exact = products.filter((p) => p.reportNumber !== null && p.reportNumber === scanReportNumber);
    if (exact.length >= 1) {
      return { product: exact[0], matchType: "report_number" };
    }
  }

  const scanNormalizedName = normalizeName(scan.productName ?? "");
  const scanNormalizedManufacturer = scan.manufacturer ? normalizeName(scan.manufacturer) : null;
  if (scanNormalizedName.length === 0 || !scanNormalizedManufacturer) {
    return null;
  }

  const exactNameAndManufacturer = products.filter(
    (p) => p.normalizedName === scanNormalizedName && p.normalizedManufacturer === scanNormalizedManufacturer,
  );
  if (exactNameAndManufacturer.length === 1) {
    return { product: exactNameAndManufacturer[0], matchType: "name_manufacturer" };
  }

  return null;
}
