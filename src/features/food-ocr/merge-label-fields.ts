import type { LabelFields } from './extract-label-fields';

/**
 * 제품 정보면(productSide, 건너뛰었으면 null)과 원재료면(ingredientSide)에서
 * 각각 추출한 필드를 하나로 합친다.
 * - 제품 필드(productName·manufacturer·reportNumber)는 productSide를 우선한다.
 * - 원재료·문구 필드(ingredientsText·allergenStatement·crossContaminationStatement)는
 *   ingredientSide를 우선한다.
 * - rawText는 두 면의 원문을 '\n---\n'으로 이어 붙여 사용자 교정 시 참고할 수 있게 한다.
 */
export function mergeLabelFields(productSide: LabelFields | null, ingredientSide: LabelFields): LabelFields {
  if (!productSide) {
    return ingredientSide;
  }

  return {
    productName: productSide.productName ?? ingredientSide.productName,
    manufacturer: productSide.manufacturer ?? ingredientSide.manufacturer,
    reportNumber: productSide.reportNumber ?? ingredientSide.reportNumber,
    ingredientsText: ingredientSide.ingredientsText || productSide.ingredientsText,
    allergenStatement: ingredientSide.allergenStatement ?? productSide.allergenStatement,
    crossContaminationStatement: ingredientSide.crossContaminationStatement ?? productSide.crossContaminationStatement,
    rawText: `${productSide.rawText}\n---\n${ingredientSide.rawText}`,
  };
}
