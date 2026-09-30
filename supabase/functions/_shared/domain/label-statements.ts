// 알레르기 표시 문구 / 교차혼입 문구 추출 (설계 10.1, 브리프 Step 4).
//
// [S2 리뷰 2차 수정 — 구조 변경] 아래 원칙으로 다시 짰다(패치가 아니라
// 버그 종류 자체를 없애는 방향).
//
//   (a) 직접(direct) 판정은 가능한 모든 텍스트 — ingredientsBody, 찾아낸
//       모든 함유/알레르기 절(첫 번째만이 아니라 전부), 호출자가 준
//       allergenStatement·crossContaminationStatement 그대로, rawText —
//       를 본문 토크나이저와 문장 토크나이저 둘 다로 훑는다.
//   (b) 교차혼입은 "그 알레르기가 다른 곳에서 직접 매칭되지 않았을 때만"
//       보고한다(순수 가산적 — allergen-matcher.ts의 최종 병합 단계에서
//       처리한다). 절대 직접을 교차혼입으로 격하하지 않는다.
//   (c) 교차혼입 절이 지배하는 항목 목록은 "이전 절 경계(문장 시작,
//       콤마 목록, 함유 단서, 원재료(명)/콜론, 이 제품은) ~ 트리거
//       시작"까지다(또는 "시설에서 ~ 사용한"처럼 트리거가 목록보다
//       먼저 오는 어순은 그 반대) — "트리거부터 문장 끝까지"가 아니다.
//       트리거 뒤에 오는 텍스트는 직접 판정 대상으로 본문에 남긴다.
//   (d) 같은 줄에서 절을 찾았다고 원재료 본문을 비우지 않는다. 같은
//       텍스트가 본문 스캔과 문장 스캔 모두에 나타날 수 있으며 중복은
//       allergen-matcher.ts가 (allergenId, kind, source)로 합친다.
//   (e) 정규식으로 무언가를 찾기 전에 항상 제로폭 문자를 먼저 걷어낸다.
//
// [S2 리뷰 3차 수정, 룰링 R12] label_context 용어(알류, 조개류, 아황산류)
// 매칭에 "함유 절 안에서만"이라는 문맥 제약을 더는 두지 않는다 —
// allergen-matcher.ts가 본문 토크나이저에서도 exact_token과 동일하게
// 원자 토큰 정확 일치로 매칭한다. 이 파일의 역할은 "어느 텍스트가
// 교차혼입 전용인지"만 가려내는 것으로 좁아졌다 — 교차혼입 지배 항목
// 목록만 골라내고, 나머지는 전부(함유 절이든 아니든) direct 판정
// 대상으로 남긴다.
//
// scan 필드가 이미 채워져 있으면 그대로 쓴다(제로폭 문자 제거는 예외로
// 항상 적용). rawText는 항상(폴백이 아니라) 본문에 더해져 direct
// 판정에 쓰인다(룰링 7).

import { isDigit } from "./ingredient-parser.ts";
import { stripZeroWidth } from "./normalize.ts";
import type { ScanPayload } from "./types.ts";

const CROSS_CONTAMINATION_RE = /(같은|동일한)\s*(제조)?\s*시설|혼입\s*가능/;
// "…을/를 사용한 제품과 같은 (제조)?시설" 전체 구문(full-form). 이 구문
// 앞에는 쉼표로 나열된 여러 항목이 공유 조사를 거느릴 수 있다(예: "땅콩,
// 게를 사용한 제품과 같은 제조시설").
const CROSS_FULL_FORM_RE = /(을|를)?\s*사용한\s*제품과\s*같은\s*(제조)?\s*시설/;
// 트리거가 항목 목록보다 먼저 오는 어순(예: "같은 제조시설에서 땅콩,
// 알류를 사용한 제품을 제조"). "시설에서" 뒤에 목록이 오고, 대개
// "(을|를)? 사용한"으로 끝난다.
const USED_RE = /(을|를)?\s*사용한/;
export const ALLERGEN_CUE_RE = /알레르기|알러지|함유|포함|유발물질/;
// 절 경계 표식: 이 단어/문자가 나오면 그 앞은 다른 절(원재료 목록 헤더 등)
// 이므로 교차혼입 지배 항목 목록에서 제외한다.
const CLAUSE_BOUNDARY_EXCLUDE_RE = /원재료명|원재료|:/;
// "이 제품은"은 새 절의 시작을 알리되, 그 뒤에 오는 내용은(트리거까지)
// 지배 항목 목록에 포함한다(그 앞만 제외한다).
const SENTENCE_START_RE = /이\s*제품은/;

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
 *   - 괄호(소괄호·대괄호) 안의 구분자는 무시한다(깊이 추적).
 *
 * '/'는 여기서 문장 구분자로 쓰지 않는다(2차 리뷰에서 old/new 비교
 * 프로브로 발견한 회귀 — 원재료 파서와 문장 토크나이저가 각자 '/'를
 * 처리하므로 문장을 미리 나눌 필요가 없다).
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
 * endIndex 앞에 짝이 안 맞는 여는 괄호가 있으면(즉 endIndex가 괄호
 * 안이면) 그 괄호 바로 뒤가 목록이 넘어갈 수 없는 바닥이다 — 괄호 안
 * 내용(복합원재료 자식 등)은 교차혼입 지배 목록에 들어가지 않는다.
 */
function findBracketFloor(sentence: string, endIndex: number): number {
  let depth = 0; // 짝 맞는 ')'를 센다
  for (let i = endIndex - 1; i >= 0; i -= 1) {
    const ch = sentence[i];
    if (CLOSE_BRACKETS.has(ch)) {
      depth += 1;
    } else if (OPEN_BRACKETS.has(ch)) {
      if (depth === 0) return i + 1;
      depth -= 1;
    }
  }
  return 0;
}

/**
 * endIndex(트리거 직전 목록의 끝)부터 쉼표 목록을 뒤에서부터 훑어, 절
 * 경계(함유/알레르기 단서, "원재료(명):", 괄호 닫힘)를 만나면 그 절은
 * 제외하고 멈춘다. "이 제품은"을 만나면 그 뒤(트리거 쪽)만 포함해
 * 멈춘다. 아무 경계도 못 만나면 문장 시작까지 전부 포함하되, 짝이 안
 * 맞는 여는 괄호 밖으로는 넘어가지 않는다(findBracketFloor).
 */
function findListStart(sentence: string, endIndex: number): number {
  const floor = findBracketFloor(sentence, endIndex);
  const before = sentence.slice(floor, endIndex);
  // ','뿐 아니라 '/'도 항목 경계로 본다 — "알류 함유/ 땅콩과 같은 시설"
  // 처럼 쉼표 없이 '/'로만 함유 절과 교차혼입 절이 붙어 있을 때, '/'를
  // 쪼개지 않으면 "함유"가 있는 절 전체(뒤의 "땅콩"까지)가 통째로
  // 제외되어 실제 지배 항목까지 direct로 잘못 넘어간다.
  const segments = before.split(/[,/]/);
  const segmentStarts: number[] = [];
  let cursor = floor;
  for (const segment of segments) {
    segmentStarts.push(cursor);
    cursor += segment.length + 1; // +1 for the delimiter
  }
  for (let s = segments.length - 1; s >= 0; s -= 1) {
    const segment = segments[s];
    if (
      ALLERGEN_CUE_RE.test(segment) ||
      CLAUSE_BOUNDARY_EXCLUDE_RE.test(segment) ||
      segment.includes(")") ||
      segment.includes("]")
    ) {
      return Math.min(segmentStarts[s] + segment.length + 1, endIndex);
    }
    const sentenceStartMatch = SENTENCE_START_RE.exec(segment);
    if (sentenceStartMatch) {
      return segmentStarts[s] + sentenceStartMatch.index + sentenceStartMatch[0].length;
    }
  }
  return floor;
}

/**
 * short-form 트리거("~과/와 같은 (제조)?시설", "혼입 가능")의 목록 끝
 * 경계를 찾는다 — 비교 조사(와/과)가 트리거 바로 앞에 있으면 그 앞까지가
 * 목록이다.
 */
function findShortFormListEnd(sentence: string, triggerStart: number): number {
  let i = triggerStart;
  while (i > 0 && /\s/.test(sentence[i - 1])) i -= 1;
  if (i > 0 && (sentence[i - 1] === "과" || sentence[i - 1] === "와")) i -= 1;
  return i;
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

/**
 * 문장 하나에서 교차혼입 트리거 "하나"를 찾아 지배 항목 목록만
 * 떼어낸다(여러 트리거는 extractAllCrossSpans가 재귀로 처리한다).
 * 세 어순을 구분한다:
 *   1. full-form: "…을 사용한 제품과 같은 시설" — 목록이 트리거 앞.
 *   2. trigger-first: "같은 시설에서 … 사용한" — 목록이 트리거 뒤,
 *      비교 조사(와/과)가 트리거 바로 앞에 없을 때만(있으면 short-form).
 *   3. short-form: "~와/과 같은 시설", "혼입 가능" — 목록이 트리거 앞,
 *      쉼표 목록을 전부 훑는다(단일 항목만 잡던 이전 동작을 일반화).
 */
function extractCrossClause(sentence: string): CrossClauseResult {
  const triggerMatch = CROSS_CONTAMINATION_RE.exec(sentence);
  if (!triggerMatch) return { cross: null, before: sentence, after: "" };

  const fullFormMatch = CROSS_FULL_FORM_RE.exec(sentence);
  if (fullFormMatch) {
    const crossStart = findListStart(sentence, fullFormMatch.index);
    const triggerEnd = fullFormMatch.index + fullFormMatch[0].length;
    const cross = sentence.slice(crossStart, triggerEnd).trim();
    if (cross.length === 0) return { cross: null, before: sentence, after: "" };
    return { cross, before: sentence.slice(0, crossStart), after: sentence.slice(triggerEnd) };
  }

  const triggerEnd = triggerMatch.index + triggerMatch[0].length;
  let hasParticleBefore = false;
  {
    let i = triggerMatch.index;
    while (i > 0 && /\s/.test(sentence[i - 1])) i -= 1;
    hasParticleBefore = i > 0 && (sentence[i - 1] === "과" || sentence[i - 1] === "와");
  }

  if (!hasParticleBefore) {
    const afterTrigger = sentence.slice(triggerEnd);
    // trigger-first 어순: "같은 (제조)?시설에서 <목록>(을|를)? 사용한"
    // 이거나, "혼입 가능: <목록>"처럼 콜론으로 목록을 이어 쓰는 경우.
    const afterMatch = /^\s*(에서|:)\s*/.exec(afterTrigger);
    if (afterMatch) {
      const listStart = triggerEnd + afterMatch[0].length;
      const rest = sentence.slice(listStart);
      const usedMatch = USED_RE.exec(rest);
      const itemsEnd = usedMatch ? listStart + usedMatch.index + usedMatch[0].length : sentence.length;
      const cross = sentence.slice(triggerMatch.index, itemsEnd).trim();
      if (cross.length === 0) return { cross: null, before: sentence, after: "" };
      return {
        cross,
        before: sentence.slice(0, triggerMatch.index),
        after: sentence.slice(itemsEnd),
      };
    }
  }

  // short-form: 목록이 트리거 앞(단일 항목이 아니라 쉼표 목록 전체).
  const listEnd = findShortFormListEnd(sentence, triggerMatch.index);
  const crossStart = findListStart(sentence, listEnd);
  const cross = sentence.slice(crossStart, triggerEnd).trim();
  if (cross.length === 0) return { cross: null, before: sentence, after: "" };
  return { cross, before: sentence.slice(0, crossStart), after: sentence.slice(triggerEnd) };
}

/**
 * 문장 하나에서 교차혼입 트리거를 "전부" 찾는다(한 문장에 여러 트리거가
 * 있을 수 있다 — 첫 번째만 찾고 멈추지 않는다). 트리거를 찾을 때마다
 * 지배 항목 목록을 떼어내고, 앞뒤 나머지에서 재귀적으로 또 찾는다.
 */
function extractAllCrossSpans(sentence: string, crossSpansOut: string[]): string {
  const { cross, before, after } = extractCrossClause(sentence);
  if (!cross) return sentence;
  crossSpansOut.push(cross);
  const beforeRemainder = before.trim().length > 0 ? extractAllCrossSpans(before, crossSpansOut) : "";
  const afterRemainder = after.trim().length > 0 ? extractAllCrossSpans(after, crossSpansOut) : "";
  return `${beforeRemainder} ${afterRemainder}`.trim();
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
    const remainder = extractAllCrossSpans(sentence, crossSpans);
    if (remainder.length > 0) remainderParts.push(remainder);
  }

  return { crossSpans, remainder: remainderParts.join("\n") };
}

/** 문장 목록에서 교차혼입 지배 항목을 전부 빼내고 나머지를 돌려준다. */
function processSentencesForCross(
  sentences: string[],
  crossSpansOut: string[],
): string[] {
  const remaining: string[] = [];
  for (const sentence of sentences) {
    const remainder = extractAllCrossSpans(sentence, crossSpansOut);
    if (remainder.length > 0) remaining.push(remainder);
  }
  return remaining;
}

export function extractStatements(scan: StatementInput): ExtractResult {
  const ingredientsText = stripZeroWidth(scan.ingredientsText);
  const rawText = stripZeroWidth(scan.rawText);

  let allergen = isBlank(scan.allergenStatement) ? null : stripZeroWidth(scan.allergenStatement);
  let crossContamination = isBlank(scan.crossContaminationStatement)
    ? null
    : stripZeroWidth(scan.crossContaminationStatement);
  const allergenWasGiven = allergen !== null;

  const needCross = crossContamination === null;

  // ingredientsText: 교차혼입이 필요하면 절 단위로 지배 항목만 뺀다.
  // 필요 없으면(필드가 이미 주어졌으면) 문장을 그대로 둔다.
  const sentences = splitSentences(ingredientsText);
  let remaining: string[];
  if (needCross) {
    const crossSpans: string[] = [];
    remaining = processSentencesForCross(sentences, crossSpans);
    if (crossSpans.length > 0) crossContamination = crossSpans.join(", ");
  } else {
    remaining = sentences;
  }
  const ingredientsBody = remaining.join("\n");

  // 룰링 7: allergenStatement가 이미 주어졌어도, ingredientsText에서
  // 찾은 함유/알레르기 절은 항상 문장 토크나이저로도 훑을 수 있도록
  // allergen 필드에 덧붙인다(조사 제거·붙어 있는 서술어 처리 등 문장
  // 토크나이저만의 이점을 놓치지 않는다). 찾아낸 절 전부를 모은다.
  const cueSentences = remaining.filter((s) => ALLERGEN_CUE_RE.test(s));
  if (cueSentences.length > 0) {
    allergen = allergenWasGiven ? `${allergen}\n${cueSentences.join("\n")}` : cueSentences.join("\n");
  }

  // 룰링 7: rawText는 폴백이 아니라 항상 direct 판정에 더해진다 —
  // ingredientsText/allergenStatement/crossContaminationStatement가
  // 이미 채워졌어도 rawText의 내용은 계속 스캔 대상이다. crossContamination
  // 필드 자체는 비어 있을 때만 rawText에서 채운다(이미 있으면 덮어쓰지
  // 않는다).
  let finalIngredientsBody = ingredientsBody;
  if (rawText.trim().length > 0) {
    const rawSentences = splitSentences(rawText);
    let rawRemaining: string[];
    if (crossContamination === null) {
      const rawCrossSpans: string[] = [];
      rawRemaining = processSentencesForCross(rawSentences, rawCrossSpans);
      if (rawCrossSpans.length > 0) crossContamination = rawCrossSpans.join(", ");
    } else {
      rawRemaining = rawSentences;
    }
    if (rawRemaining.length > 0) {
      finalIngredientsBody = finalIngredientsBody.length > 0
        ? `${finalIngredientsBody}\n${rawRemaining.join("\n")}`
        : rawRemaining.join("\n");
    }
    const rawCueSentences = rawRemaining.filter((s) => ALLERGEN_CUE_RE.test(s));
    if (rawCueSentences.length > 0) {
      allergen = allergen ? `${allergen}\n${rawCueSentences.join("\n")}` : rawCueSentences.join("\n");
    }
  }

  return { allergen, crossContamination, ingredientsBody: finalIngredientsBody };
}
