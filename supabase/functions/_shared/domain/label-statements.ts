// 알레르기 표시 문구 / 교차혼입 문구 추출 (설계 10.1, 브리프 Step 4).
//
// [S2 리뷰 2차 수정 — 구조 변경] 아래 원칙으로 다시 짰다(패치가 아니라
// 버그 종류 자체를 없애는 방향).
//
//   (a) 직접(direct) 판정은 가능한 모든 텍스트 — ingredientsBody, 찾아낸
//       모든 함유/알레르기 절(첫 번째만이 아니라 전부), 호출자가 준
//       allergenStatement·crossContaminationStatement 그대로, rawText —
//       를 본문 토크나이저와 문장 토크나이저 둘 다로 훑는다. label_context
//       용어(알류, 조개류, 아황산류)는 함유/포함/알레르기/알러지/유발물질
//       단서가 있는 절이나 allergenStatement 필드에서만 직접 매칭을
//       허용한다.
//   (b) 교차혼입은 "그 알레르기가 다른 곳에서 직접 매칭되지 않았을 때만"
//       보고한다(순수 가산적 — allergen-matcher.ts의 최종 병합 단계에서
//       처리한다). 절대 직접을 교차혼입으로 격하하지 않는다.
//   (c) 교차혼입 절이 지배하는 항목 목록은 "이전 절 경계(문장 시작,
//       있으며/하며/하고로 끝나는 절 뒤의 쉼표, 또는 함유 단서) ~ 트리거
//       시작"까지다 — "트리거부터 문장 끝까지"가 아니다. 트리거 뒤에
//       오는 텍스트(원재료, 함유 절 등)는 직접 판정 대상으로 본문에
//       남긴다.
//   (d) 같은 줄에서 절을 찾았다고 원재료 본문을 비우지 않는다. 같은
//       텍스트가 본문 스캔과 문장 스캔 모두에 나타날 수 있으며 중복은
//       allergen-matcher.ts가 (allergenId, kind, source)로 합친다.
//   (e) 정규식으로 무언가를 찾기 전에 항상 제로폭 문자를 먼저 걷어낸다.
//
// scan 필드가 이미 채워져 있으면 그대로 쓴다(제로폭 문자 제거는 예외로
// 항상 적용). 비어 있을 때만 ingredientsText, 그 다음 rawText에서 절을
// 찾는다.

import { isDigit } from "./ingredient-parser.ts";
import { stripZeroWidth } from "./normalize.ts";
import type { ScanPayload } from "./types.ts";

const CROSS_CONTAMINATION_RE = /(같은|동일한)\s*(제조)?\s*시설|혼입\s*가능/;
// "…을/를 사용한 제품과 같은 (제조)?시설" 전체 구문(full-form). 이 구문
// 앞에는 쉼표로 나열된 여러 항목이 공유 조사를 거느릴 수 있다(예: "땅콩,
// 게를 사용한 제품과 같은 제조시설").
const CROSS_FULL_FORM_RE = /(을|를)?\s*사용한\s*제품과\s*같은\s*(제조)?\s*시설/;
export const ALLERGEN_CUE_RE = /알레르기|알러지|함유|포함|유발물질/;

const OPEN_BRACKETS = new Set(["(", "["]);
const CLOSE_BRACKETS = new Set([")", "]"]);

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
 * 문장 경계로 분리한다. '.', '\n', '。'를 구분자로 쓰되,
 *   - 숫자 사이의 '.'(예: "12.5")은 소수점이므로 문장 경계로 보지 않는다.
 *   - 괄호(소괄호·대괄호) 안의 구분자는 무시한다(깊이 추적) — "혼합제제
 *     (대두. 우유)"의 '.'이 괄호 구조를 깨지 않도록.
 *
 * '/'는 여기서 문장 구분자로 쓰지 않는다 — "땅콩/게를 사용한 제품과
 * 같은 제조시설"처럼 교차혼입 트리거가 지배하는 항목 목록 안에서 '/'가
 * 단순 나열 구분자로 쓰이는 경우가 있는데, 여기서 문장을 나누면 앞
 * 항목(땅콩)이 트리거의 지배 범위 밖으로 떨어져 나가 직접(direct)으로
 * 잘못 분류된다(2차 리뷰에서 old/new 비교 프로브로 발견한 회귀).
 * '/'로 원재료·문구 섹션을 나눈 텍스트는 통계 텍스트 토크나이저와 원재료
 * 파서가 각자 '/'를 낱말 구분자로 처리하므로, 문장을 미리 나누지 않아도
 * 값을 올바르게 찾는다.
 */
function splitSentences(text: string): string[] {
  const chars = [...text];
  const segments: string[] = [];
  let depth = 0;
  let current = "";

  for (let i = 0; i < chars.length; i += 1) {
    const ch = chars[i];
    if (OPEN_BRACKETS.has(ch)) {
      depth += 1;
      current += ch;
      continue;
    }
    if (CLOSE_BRACKETS.has(ch)) {
      depth = Math.max(0, depth - 1);
      current += ch;
      continue;
    }
    if (depth === 0) {
      if (ch === "\n" || ch === "。") {
        segments.push(current);
        current = "";
        continue;
      }
      if (ch === ".") {
        const isDecimal = isDigit(chars[i - 1]) && isDigit(chars[i + 1]);
        if (!isDecimal) {
          segments.push(current);
          current = "";
          continue;
        }
      }
    }
    current += ch;
  }
  segments.push(current);

  return segments.map((s) => s.trim()).filter((s) => s.length > 0);
}

function isBlank(value: string | null): value is null {
  return value === null || value.trim().length === 0;
}

/**
 * short-form 트리거("~과/와 같은 (제조)?시설", "혼입 가능")는 "사용한
 * 제품과" 없이 비교 조사 하나만으로 단일 항목을 가리킨다. particleEnd부터
 * 뒤로 스캔해 쉼표/공백/문장 시작을 만날 때까지의 단일 단어 시작 위치를
 * 찾는다.
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
    if (ALLERGEN_CUE_RE.test(segments[s])) {
      return segmentStarts[s] + segments[s].length + 1;
    }
  }
  return 0;
}

type CrossClauseResult = {
  /** 트리거가 지배하는 항목 목록(트리거 문구 포함). 없으면 null. */
  cross: string | null;
  /** 지배 항목 목록 앞의 텍스트(직접 판정 대상으로 남는다). */
  before: string;
  /** 트리거 뒤의 텍스트(직접 판정 대상으로 남는다) — "트리거~문장 끝"을
   *  통째로 교차혼입으로 삼지 않는다(규칙 c). */
  after: string;
};

/** 문장 하나에서 교차혼입 트리거를 찾아 지배 항목 목록만 떼어낸다. */
function extractCrossClause(sentence: string): CrossClauseResult {
  const triggerMatch = CROSS_CONTAMINATION_RE.exec(sentence);
  if (!triggerMatch) return { cross: null, before: sentence, after: "" };

  const fullFormMatch = CROSS_FULL_FORM_RE.exec(sentence);
  const isFullForm = fullFormMatch !== null;

  const crossStart = isFullForm
    ? findFullFormItemStart(sentence, fullFormMatch.index)
    : findShortFormItemStart(sentence, triggerMatch.index);

  const triggerEnd = isFullForm
    ? fullFormMatch.index + fullFormMatch[0].length
    : triggerMatch.index + triggerMatch[0].length;

  const cross = sentence.slice(crossStart, triggerEnd).trim();
  if (cross.length === 0) return { cross: null, before: sentence, after: "" };

  return {
    cross,
    before: sentence.slice(0, crossStart),
    after: sentence.slice(triggerEnd),
  };
}

/**
 * 텍스트 전체(여러 문장일 수 있다)에서 교차혼입 지배 항목 목록을 전부
 * 뽑아내고, 그 목록을 제외한 나머지(직접 판정 대상)를 돌려준다. 호출자가
 * crossContaminationStatement 필드를 직접 줬을 때도 allergen-matcher.ts가
 * 이 함수로 절 단위 분리를 적용한다(출처와 무관하게 동일하게 처리).
 */
export function splitCrossClauses(text: string): { crossSpans: string[]; remainder: string } {
  const sentences = splitSentences(stripZeroWidth(text));
  const crossSpans: string[] = [];
  const remainderParts: string[] = [];

  for (const sentence of sentences) {
    const { cross, before, after } = extractCrossClause(sentence);
    if (cross) crossSpans.push(cross);
    const remainder = `${before} ${after}`.trim();
    if (remainder.length > 0) remainderParts.push(remainder);
  }

  return { crossSpans, remainder: remainderParts.join("\n") };
}

export function extractStatements(scan: StatementInput): ExtractResult {
  const ingredientsText = stripZeroWidth(scan.ingredientsText);
  const rawText = stripZeroWidth(scan.rawText);

  let allergen = isBlank(scan.allergenStatement) ? null : stripZeroWidth(scan.allergenStatement);
  let crossContamination = isBlank(scan.crossContaminationStatement)
    ? null
    : stripZeroWidth(scan.crossContaminationStatement);
  let ingredientsBody = ingredientsText;

  const needCross = crossContamination === null;
  const needAllergen = allergen === null;

  if (needCross || needAllergen) {
    const sentences = splitSentences(ingredientsText);
    const crossSpans: string[] = [];
    const cueSentences: string[] = [];
    const remaining: string[] = [];

    for (const sentence of sentences) {
      if (needCross) {
        const { cross, before, after } = extractCrossClause(sentence);
        if (cross) crossSpans.push(cross);
        const remainder = `${before} ${after}`.trim();
        if (remainder.length > 0) {
          remaining.push(remainder);
          if (needAllergen && ALLERGEN_CUE_RE.test(remainder)) cueSentences.push(remainder);
        }
      } else {
        // crossContamination이 이미 주어졌으므로 문장에서 교차혼입 절을
        // 따로 떼어내지 않는다 — 본문은 그대로 두고 함유 단서만 찾는다.
        remaining.push(sentence);
        if (needAllergen && ALLERGEN_CUE_RE.test(sentence)) cueSentences.push(sentence);
      }
    }

    if (needCross && crossSpans.length > 0) {
      crossContamination = crossSpans.join(", ");
    }
    if (needAllergen && cueSentences.length > 0) {
      // 찾아낸 모든 함유/알레르기 절을 모은다(첫 번째만이 아니라 전부).
      allergen = cueSentences.join("\n");
    }
    // 규칙 (d): 절을 찾았다고 본문을 비우지 않는다 — 교차혼입 지배
    // 항목 목록만 빠지고, 함유 절을 포함한 나머지는 모두 본문에 남아
    // 원재료 토크나이저로도 스캔된다(중복은 매처가 합친다).
    ingredientsBody = remaining.join("\n");
  }

  if ((crossContamination === null || allergen === null) && rawText.trim().length > 0) {
    const sentences = splitSentences(rawText);
    const crossSpans: string[] = [];
    const cueSentences: string[] = [];
    for (const sentence of sentences) {
      const { cross, before, after } = extractCrossClause(sentence);
      if (cross) crossSpans.push(cross);
      const remainder = `${before} ${after}`.trim();
      if (remainder.length > 0 && ALLERGEN_CUE_RE.test(remainder)) cueSentences.push(remainder);
    }
    if (crossContamination === null && crossSpans.length > 0) {
      crossContamination = crossSpans.join(", ");
    }
    if (allergen === null && cueSentences.length > 0) {
      allergen = cueSentences.join("\n");
    }
  }

  return { allergen, crossContamination, ingredientsBody };
}
