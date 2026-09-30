import type { ScanPayload } from '@/shared/config/bridge-contract';

// OCR 원문에서 라벨 필드를 정규식으로 추출한다 (브리프 Step 1 패턴 그대로).
// 정규식은 실제 식품 라벨 표기 관례(줄바꿈이 뒤섞인 OCR 결과 포함)를
// 기준으로 하며, 모든 필드는 사용자가 ScannerReview에서 다시 교정한다.

export type LabelFields = Omit<ScanPayload, 'userReviewed'>;

const PRODUCT_NAME_PATTERN = /제품명\s*[:：]?\s*(.+)/;
const MANUFACTURER_LABEL_PATTERN = /(제조원|제조사|제조업소|제조자)\s*[:：]?\s*(.+)/;
const REPORT_NUMBER_PATTERN = /품목\s*보고\s*번호\s*[:：]?\s*([0-9\- ]{8,24})/;
const INGREDIENTS_START_PATTERN = /원재료\s*명?(?:\s*및\s*함량)?\s*[:：]?\s*/;
const INGREDIENTS_STOP_MARKERS = ['알레르기', '이 제품은', '내용량', '보관', '유통기한', '소비기한', '제조원', '영양정보'];
const CROSS_CONTAMINATION_PATTERN = /(같은|동일한)\s*(제조)?\s*시설|혼입/;
// 제조사 뒤에 이어지는 주소 시작 지점을 찾는다. "경기도 화성시 ..."처럼
// 짧은 한글 단어 뒤에 행정구역 접미어가 붙고 다시 공백이 이어지는 지점을
// 주소 시작으로 본다.
const ADDRESS_START_PATTERN = /\s(?=[가-힣]{1,10}(?:특별시|광역시|특별자치시|특별자치도|도|시|군|구)\s)/;

const MAX_NAME_LENGTH = 200;
const MAX_INGREDIENTS_LENGTH = 8000;
const MAX_STATEMENT_LENGTH = 1000;
const MAX_RAW_TEXT_LENGTH = 20000;
const MAX_REPORT_NUMBER_LENGTH = 20;

function extractProductName(rawText: string): string | null {
  const match = PRODUCT_NAME_PATTERN.exec(rawText);
  if (!match) {
    return null;
  }
  const value = match[1].trim();
  return value.length > 0 ? value.slice(0, MAX_NAME_LENGTH) : null;
}

function extractManufacturer(rawText: string): string | null {
  const match = MANUFACTURER_LABEL_PATTERN.exec(rawText);
  if (!match) {
    return null;
  }

  let value = match[2].trim();

  const commaIndex = value.indexOf(',');
  if (commaIndex >= 0) {
    value = value.slice(0, commaIndex).trim();
  } else {
    const addressMatch = ADDRESS_START_PATTERN.exec(value);
    if (addressMatch) {
      value = value.slice(0, addressMatch.index).trim();
    }
  }

  return value.length > 0 ? value.slice(0, MAX_NAME_LENGTH) : null;
}

function extractReportNumber(rawText: string): string | null {
  const match = REPORT_NUMBER_PATTERN.exec(rawText);
  if (!match) {
    return null;
  }
  const digitsOnly = match[1].replace(/[^0-9]/g, '');
  return digitsOnly.length > 0 ? digitsOnly.slice(0, MAX_REPORT_NUMBER_LENGTH) : null;
}

function extractIngredientsText(rawText: string): string {
  const startMatch = INGREDIENTS_START_PATTERN.exec(rawText);
  if (!startMatch) {
    return '';
  }

  const afterStart = rawText.slice(startMatch.index + startMatch[0].length);

  let stopIndex = afterStart.length;
  for (const marker of INGREDIENTS_STOP_MARKERS) {
    const markerIndex = afterStart.indexOf(marker);
    if (markerIndex >= 0 && markerIndex < stopIndex) {
      stopIndex = markerIndex;
    }
  }

  const value = afterStart.slice(0, stopIndex).replace(/\s+/g, ' ').trim();
  return value.slice(0, MAX_INGREDIENTS_LENGTH);
}

function splitSentences(rawText: string): string[] {
  return rawText
    .split(/[\n.]+/)
    .map((sentence) => sentence.trim())
    .filter((sentence) => sentence.length > 0);
}

function extractAllergenAndCrossContamination(rawText: string): {
  allergenStatement: string | null;
  crossContaminationStatement: string | null;
} {
  const allergenSentences: string[] = [];
  const crossContaminationSentences: string[] = [];

  for (const sentence of splitSentences(rawText)) {
    if (CROSS_CONTAMINATION_PATTERN.test(sentence)) {
      crossContaminationSentences.push(sentence);
      continue;
    }
    if (sentence.includes('알레르기') || sentence.includes('함유')) {
      allergenSentences.push(sentence);
    }
  }

  return {
    allergenStatement:
      allergenSentences.length > 0 ? allergenSentences.join(' ').slice(0, MAX_STATEMENT_LENGTH) : null,
    crossContaminationStatement:
      crossContaminationSentences.length > 0
        ? crossContaminationSentences.join(' ').slice(0, MAX_STATEMENT_LENGTH)
        : null,
  };
}

export function extractLabelFields(rawText: string): LabelFields {
  const { allergenStatement, crossContaminationStatement } = extractAllergenAndCrossContamination(rawText);

  return {
    productName: extractProductName(rawText),
    manufacturer: extractManufacturer(rawText),
    reportNumber: extractReportNumber(rawText),
    ingredientsText: extractIngredientsText(rawText),
    allergenStatement,
    crossContaminationStatement,
    rawText: rawText.slice(0, MAX_RAW_TEXT_LENGTH),
  };
}
