import { mergeLabelFields } from './merge-label-fields';
import type { LabelFields } from './extract-label-fields';

function makeFields(overrides: Partial<LabelFields> = {}): LabelFields {
  return {
    productName: null,
    manufacturer: null,
    reportNumber: null,
    ingredientsText: '',
    allergenStatement: null,
    crossContaminationStatement: null,
    rawText: '',
    ...overrides,
  };
}

describe('mergeLabelFields', () => {
  it('productSide가 null이면 ingredientSide를 그대로 사용한다', () => {
    const ingredientSide = makeFields({ ingredientsText: '밀가루', rawText: '원재료명 : 밀가루' });

    expect(mergeLabelFields(null, ingredientSide)).toEqual(ingredientSide);
  });

  it('제품 필드는 productSide를 우선한다', () => {
    const productSide = makeFields({ productName: '과자', manufacturer: '대한식품', reportNumber: '123', rawText: 'A' });
    const ingredientSide = makeFields({
      productName: '다른이름',
      manufacturer: '다른제조사',
      reportNumber: '999',
      ingredientsText: '밀가루',
      rawText: 'B',
    });

    const merged = mergeLabelFields(productSide, ingredientSide);

    expect(merged.productName).toBe('과자');
    expect(merged.manufacturer).toBe('대한식품');
    expect(merged.reportNumber).toBe('123');
  });

  it('제품면에 제품 필드가 없으면 원재료면 값으로 보완한다', () => {
    const productSide = makeFields({ rawText: 'A' });
    const ingredientSide = makeFields({ productName: '과자', manufacturer: '대한식품', rawText: 'B' });

    const merged = mergeLabelFields(productSide, ingredientSide);

    expect(merged.productName).toBe('과자');
    expect(merged.manufacturer).toBe('대한식품');
  });

  it('원재료·알레르기·교차혼입 문구는 ingredientSide를 우선한다', () => {
    const productSide = makeFields({
      ingredientsText: '제품면 원재료',
      allergenStatement: '제품면 알레르기',
      crossContaminationStatement: '제품면 교차혼입',
      rawText: 'A',
    });
    const ingredientSide = makeFields({
      ingredientsText: '원재료면 원재료',
      allergenStatement: '원재료면 알레르기',
      crossContaminationStatement: '원재료면 교차혼입',
      rawText: 'B',
    });

    const merged = mergeLabelFields(productSide, ingredientSide);

    expect(merged.ingredientsText).toBe('원재료면 원재료');
    expect(merged.allergenStatement).toBe('원재료면 알레르기');
    expect(merged.crossContaminationStatement).toBe('원재료면 교차혼입');
  });

  it('ingredientSide의 원재료·문구가 비어 있으면 productSide 값으로 보완한다', () => {
    const productSide = makeFields({ allergenStatement: '제품면 알레르기', rawText: 'A' });
    const ingredientSide = makeFields({ ingredientsText: '원재료', rawText: 'B' });

    const merged = mergeLabelFields(productSide, ingredientSide);

    expect(merged.allergenStatement).toBe('제품면 알레르기');
  });

  it('rawText는 두 면을 구분자로 결합한다', () => {
    const productSide = makeFields({ rawText: '제품면 원문' });
    const ingredientSide = makeFields({ rawText: '원재료면 원문' });

    const merged = mergeLabelFields(productSide, ingredientSide);

    expect(merged.rawText).toBe('제품면 원문\n---\n원재료면 원문');
  });
});
