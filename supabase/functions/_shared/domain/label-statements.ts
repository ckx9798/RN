// 알레르기 표시 문구 / 교차혼입 문구 추출 (설계 10.1, 브리프 Step 4).
//
// scan 필드가 이미 채워져 있으면 그대로 쓴다. 비어 있을 때만 ingredientsText,
// 그 다음 rawText에서 문장을 분리해 찾는다. ingredientsText에서 찾은 문장은
// ingredientsBody에서 제거한다(rawText에서 찾은 문장은 ingredientsText의
// 일부가 아니므로 ingredientsBody를 건드리지 않는다).
//
// [S2 리뷰 수정] 한 문장 안에 "함유" 절과 "같은 제조시설" 절이 함께 있으면
// (예: "...밀, 대두를 함유하고 있으며, 땅콩을 사용한 제품과 같은
// 제조시설에서 제조") 문장 전체를 교차혼입으로 분류해 직접 함유
// 알레르기(밀, 대두)까지 교차혼입으로 격하시키던 문제를 고쳤다. 이제
// 문장 단위가 아니라 절 단위로 나눠 교차혼입 트리거가 지배하는 부분만
// crossContamination으로 떼어내고, 나머지에 함유/알레르기 단서가 있으면
// allergen으로, 없으면 ingredientsBody에 그대로 남긴다. 안전 방향: 경계가
// 불확실하면 직접(함유) 쪽으로 남기고 교차혼입으로 끌어오지 않는다.

import type { ScanPayload } from "./types.ts";

const CROSS_CONTAMINATION_RE = /(같은|동일한)\s*(제조)?\s*시설|혼입\s*가능/;
// "…을/를 사용한 제품과 같은 (제조)?시설" 전체 구문(full-form). 이 구문
// 앞에는 쉼표로 나열된 여러 항목이 공유 조사를 거느릴 수 있다(예: "땅콩,
// 게를 사용한 제품과 같은 제조시설").
const CROSS_FULL_FORM_RE = /(을|를)?\s*사용한\s*제품과\s*같은\s*(제조)?\s*시설/;
const ALLERGEN_RE = /알레르기|알러지|함유/;

type StatementInput = Pick<
  ScanPayload,
  "ingredientsText" | "allergenStatement" | "crossContaminationStatement" | "rawText"
>;

type ExtractResult = {
  allergen: string | null;
  crossContamination: string | null;
  ingredientsBody: string;
};

/**
 * 문장 경계로 분리한다. '.', '\n', '。', '/'를 구분자로 쓰되, 숫자 사이의
 * '.'(예: "12.5")은 소수점이므로 문장 경계로 보지 않는다(M7).
 */
function splitSentences(text: string): string[] {
  return text
    .split(/(?<!\d)\.(?!\d)|[\n。/]/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

function isBlank(value: string | null): value is null {
  return value === null || value.trim().length === 0;
}

/**
 * short-form 트리거("~과/와 같은 (제조)?시설", "혼입 가능")는 "사용한
 * 제품과" 없이 비교 조사 하나만으로 단일 항목을 가리킨다(예: "…, 땅콩과
 * 같은 제조시설에서 제조" 에서는 "땅콩"만 교차혼입 항목이고 앞의 다른
 * 원재료는 아니다). particleEndIndex부터 뒤로 스캔해 쉼표/공백/문장
 * 시작을 만날 때까지의 단일 단어 시작 위치를 찾는다.
 */
function findShortFormItemStart(sentence: string, triggerStart: number): number {
  let i = triggerStart;
  while (i > 0 && /\s/.test(sentence[i - 1])) i -= 1;
  if (i > 0 && (sentence[i - 1] === "과" || sentence[i - 1] === "와")) i -= 1;
  while (i > 0 && /\s/.test(sentence[i - 1])) i -= 1;
  while (i > 0 && !/[,\s]/.test(sentence[i - 1])) i -= 1;
  return i;
}

/**
 * full-form 트리거 앞의 쉼표 목록을 뒤에서부터 훑어, 함유/알레르기 단서가
 * 있는 절을 만나면 그 절은 제외하고 멈춘다(그 절은 직접 함유 쪽에 남아야
 * 한다). 단서를 못 만나면 문장 시작까지 전부 교차혼입 항목으로 본다.
 */
function findFullFormItemStart(sentence: string, fullFormMatchIndex: number): number {
  const before = sentence.slice(0, fullFormMatchIndex);
  const segments = before.split(",");
  const segmentStarts: number[] = [];
  let cursor = 0;
  for (const segment of segments) {
    segmentStarts.push(cursor);
    cursor += segment.length + 1; // +1 for the comma
  }
  for (let s = segments.length - 1; s >= 0; s -= 1) {
    if (ALLERGEN_RE.test(segments[s])) {
      return segmentStarts[s] + segments[s].length + 1;
    }
  }
  return 0;
}

/**
 * 문장 하나를 처리해 교차혼입 절을 떼어낸다. 트리거가 없으면 그대로
 * 반환한다(cross: null, remainder: 원문 그대로).
 */
function extractCrossClause(sentence: string): { cross: string | null; remainder: string } {
  const triggerMatch = CROSS_CONTAMINATION_RE.exec(sentence);
  if (!triggerMatch) return { cross: null, remainder: sentence };

  const fullFormMatch = CROSS_FULL_FORM_RE.exec(sentence);
  const isFullForm = fullFormMatch !== null;

  const crossStart = isFullForm
    ? findFullFormItemStart(sentence, fullFormMatch.index)
    : findShortFormItemStart(sentence, triggerMatch.index);

  const cross = sentence.slice(crossStart).trim();
  const remainder = sentence.slice(0, crossStart).trim();

  if (cross.length === 0) return { cross: null, remainder: sentence };
  return { cross, remainder };
}

/**
 * 문장 하나를 분류한다: 교차혼입 절 추출 -> 남은 부분에 함유/알레르기
 * 단서가 있으면 전체를 allergen으로, 없으면 ingredientsBody에 남길
 * remainder로.
 */
function classifySentence(
  sentence: string,
  state: { needsAllergen: boolean; hasAllergen: boolean; needsCross: boolean; hasCross: boolean },
): { cross: string | null; allergen: string | null; remainder: string | null } {
  let cross: string | null = null;
  let remainder = sentence;

  if (state.needsCross && !state.hasCross) {
    const extracted = extractCrossClause(sentence);
    if (extracted.cross !== null) {
      cross = extracted.cross;
      remainder = extracted.remainder;
    }
  }

  if (state.needsAllergen && !state.hasAllergen && remainder.length > 0 && ALLERGEN_RE.test(remainder)) {
    return { cross, allergen: remainder.trim(), remainder: null };
  }

  const trimmedRemainder = remainder.trim();
  return { cross, allergen: null, remainder: trimmedRemainder.length > 0 ? trimmedRemainder : null };
}

export function extractStatements(scan: StatementInput): ExtractResult {
  let allergen = isBlank(scan.allergenStatement) ? null : scan.allergenStatement;
  let crossContamination = isBlank(scan.crossContaminationStatement)
    ? null
    : scan.crossContaminationStatement;
  let ingredientsBody = scan.ingredientsText;

  const needsAllergen = allergen === null;
  const needsCross = crossContamination === null;

  if (needsAllergen || needsCross) {
    const sentences = splitSentences(scan.ingredientsText);
    const remaining: string[] = [];
    let bodyChanged = false;

    for (const sentence of sentences) {
      const result = classifySentence(sentence, {
        needsAllergen,
        hasAllergen: allergen !== null,
        needsCross,
        hasCross: crossContamination !== null,
      });

      if (result.cross !== null && crossContamination === null) {
        crossContamination = result.cross;
        bodyChanged = true;
      }
      if (result.allergen !== null && allergen === null) {
        allergen = result.allergen;
        bodyChanged = true;
      }

      if (result.allergen !== null) {
        continue; // 문장 전체가 allergen으로 소비됨(remainder 없음)
      }
      if (result.remainder !== null) {
        if (result.remainder !== sentence) bodyChanged = true;
        remaining.push(result.remainder);
      } else if (result.cross !== null) {
        bodyChanged = true; // remainder가 비어 사라짐
      }
    }

    if (bodyChanged) {
      ingredientsBody = remaining.join("\n");
    }
  }

  if ((allergen === null || crossContamination === null) && scan.rawText.trim().length > 0) {
    const sentences = splitSentences(scan.rawText);
    for (const sentence of sentences) {
      const result = classifySentence(sentence, {
        needsAllergen: allergen === null,
        hasAllergen: allergen !== null,
        needsCross: crossContamination === null,
        hasCross: crossContamination !== null,
      });
      if (result.cross !== null && crossContamination === null) {
        crossContamination = result.cross;
      }
      if (result.allergen !== null && allergen === null) {
        allergen = result.allergen;
      }
    }
  }

  return { allergen, crossContamination, ingredientsBody };
}
