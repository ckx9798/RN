import { extractLabelFields } from './extract-label-fields';

describe('extractLabelFields', () => {
  it('줄바꿈이 뒤섞인 원재료면 OCR 텍스트에서 제품명·제조사·원재료·알레르기·교차혼입을 모두 추출한다', () => {
    const rawText = [
      '제품명 : 우리쌀 과자',
      '식품유형 : 과자',
      '원재료명 및 함량 : 쌀(국산) 60%, 설탕, 대두유,',
      '밀가루, 계란분말',
      '이 제품은 대두, 밀, 계란을 함유하고 있습니다.',
      '이 제품은 새우, 땅콩을 사용한 제품과 같은 제조시설에서 가공하고 있습니다.',
      '내용량 : 90g',
      '제조원 : (주)우리식품 경기도 화성시 향남읍 1길 23',
    ].join('\n');

    const fields = extractLabelFields(rawText);

    expect(fields.productName).toBe('우리쌀 과자');
    expect(fields.manufacturer).toBe('(주)우리식품');
    expect(fields.ingredientsText).toBe('쌀(국산) 60%, 설탕, 대두유, 밀가루, 계란분말');
    expect(fields.allergenStatement).toContain('대두, 밀, 계란을 함유');
    expect(fields.crossContaminationStatement).toContain('같은 제조시설');
    expect(fields.crossContaminationStatement).not.toContain('함유');
    expect(fields.rawText).toBe(rawText);
  });

  it('공백이 섞인 품목보고번호에서 숫자만 남긴다', () => {
    const rawText = '품목보고번호 : 2006 0123 456-78';

    const fields = extractLabelFields(rawText);

    expect(fields.reportNumber).toBe('2006012345678');
  });

  it('제조사 줄에 쉼표로 상호와 주소가 나뉘어 있으면 상호만 남긴다', () => {
    const rawText = '제조사: 대한식품(주), 서울특별시 강남구 테헤란로 123';

    const fields = extractLabelFields(rawText);

    expect(fields.manufacturer).toBe('대한식품(주)');
  });

  it('교차혼입 문장은 "혼입" 단어만으로도 인식하고 알레르기 문구와 구분한다', () => {
    const rawText = ['원재료명 : 밀가루, 설탕', '땅콩 혼입 가능성이 있습니다.'].join('\n');

    const fields = extractLabelFields(rawText);

    expect(fields.crossContaminationStatement).toContain('혼입');
    expect(fields.allergenStatement).toBeNull();
  });

  it('제품명·제조사·품목보고번호·알레르기·교차혼입 표기가 없으면 null을, 원재료를 못 찾으면 빈 문자열을 반환한다', () => {
    const rawText = '알 수 없는 텍스트만 있습니다.';

    const fields = extractLabelFields(rawText);

    expect(fields.productName).toBeNull();
    expect(fields.manufacturer).toBeNull();
    expect(fields.reportNumber).toBeNull();
    expect(fields.ingredientsText).toBe('');
    expect(fields.allergenStatement).toBeNull();
    expect(fields.crossContaminationStatement).toBeNull();
    expect(fields.rawText).toBe(rawText);
  });

  it('원재료명 뒤에 다음 표지가 없으면 텍스트 끝까지를 원재료로 취급한다', () => {
    const rawText = '원재료명 : 정제수, 설탕, 구연산';

    const fields = extractLabelFields(rawText);

    expect(fields.ingredientsText).toBe('정제수, 설탕, 구연산');
  });
});
