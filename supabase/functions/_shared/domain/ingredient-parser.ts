// 원재료 텍스트 파서 (설계 10.1).
//   - 쉼표, 가운데점, 슬래시, 줄바꿈을 구분자로 인식한다.
//   - 대괄호와 소괄호의 중첩을 보존해 복합원재료를 파싱한다.
//   - 짝이 맞지 않는 괄호도 예외 없이 처리한다.

import { normalizeText } from "./normalize.ts";
import type { IngredientNode } from "./types.ts";

// 구분자: 쉼표류, 가운데점류(·, ㆍ U+318D와 NFKC 형태 U+119E, ‧ U+2027),
// 슬래시, 줄바꿈, 세미콜론, 파이프, 하이픈·플러스·앰퍼샌드, 그리고
// 【】{}<>「」처럼 OCR이 흔히 만들어내는 유사 괄호 문자(중첩 구조가
// 아니라 단순 구분자로 취급한다).
// ':'는 여기 넣지 않는다 — "밀가루(밀:미국산)"처럼 괄호 안에서 원산지
// 등을 표기하는 콜론은 복합원재료 자식 노드 하나로 유지해야 하고,
// flattenAtoms/collectPhraseCandidates가 콜론을 이미 원자 단위로 쪼갠다.
const TOP_LEVEL_SEPARATORS =
  /[,，、·ㆍᆞ‧/\n\r;|【】{}<>「」\-+&]/;
const OPEN_BRACKETS = new Set(["(", "["]);
const CLOSE_BRACKETS = new Set([")", "]"]);

/** 숫자 한 글자인지(소수점 보호용). allergen-matcher.ts도 공유한다. */
export function isDigit(ch: string | undefined): boolean {
  return ch !== undefined && ch >= "0" && ch <= "9";
}

/** 최상위 구분자로 텍스트를 나눈다. 괄호 안의 구분자는 무시한다(깊이 추적). */
function splitTopLevel(text: string): string[] {
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
    if (depth === 0 && ch === ".") {
      // 소수점(예: "12.5%")은 구분자로 보지 않는다. 숫자 사이가 아닌
      // '.'만 구분자로 취급한다(예: "우유.대두").
      const isDecimal = isDigit(chars[i - 1]) && isDigit(chars[i + 1]);
      if (!isDecimal) {
        segments.push(current);
        current = "";
        continue;
      }
      current += ch;
      continue;
    }
    if (depth === 0 && TOP_LEVEL_SEPARATORS.test(ch)) {
      segments.push(current);
      current = "";
      continue;
    }
    current += ch;
  }
  segments.push(current);

  return segments.map((s) => s.trim()).filter((s) => s.length > 0);
}

/** 세그먼트 안에서 최상위 깊이의 첫 여는 괄호 위치를 찾는다. */
function findTopLevelOpenBracket(text: string): number {
  for (let i = 0; i < text.length; i += 1) {
    if (OPEN_BRACKETS.has(text[i])) return i;
  }
  return -1;
}

/**
 * 여는 괄호 위치부터 짝이 맞는 닫는 괄호 위치를 찾는다. 짝이 없으면
 * 문자열 끝까지를 내부 구문으로 간주해 -1을 반환하지 않고 length를 준다.
 */
function findMatchingCloseBracket(text: string, openIndex: number): number {
  let depth = 0;
  for (let i = openIndex; i < text.length; i += 1) {
    const ch = text[i];
    if (OPEN_BRACKETS.has(ch)) {
      depth += 1;
      continue;
    }
    if (CLOSE_BRACKETS.has(ch)) {
      depth -= 1;
      if (depth === 0) return i;
    }
  }
  return -1; // 짝이 맞지 않음 — 끝까지를 내부로 취급한다.
}

function parseSegment(segment: string): IngredientNode {
  const openIndex = findTopLevelOpenBracket(segment);

  if (openIndex === -1) {
    const raw = segment.trim();
    return { raw, normalized: normalizeText(raw), children: [] };
  }

  const name = segment.slice(0, openIndex).trim();
  const closeIndex = findMatchingCloseBracket(segment, openIndex);
  const innerEnd = closeIndex === -1 ? segment.length : closeIndex;
  const inner = segment.slice(openIndex + 1, innerEnd);
  const trailing = closeIndex === -1 ? "" : segment.slice(closeIndex + 1).trim();

  const raw = trailing.length > 0 ? `${name} ${trailing}`.trim() : name;

  return {
    raw,
    normalized: normalizeText(raw),
    children: parseIngredients(inner),
  };
}

/** 원재료 텍스트를 중첩 괄호를 보존한 트리로 파싱한다. */
export function parseIngredients(text: string): IngredientNode[] {
  const segments = splitTopLevel(text);
  return segments.map(parseSegment);
}

/** 퍼센트 수치 토큰(예: "12.5%", "10") — flattenAtoms와 collectPhraseCandidates가 공유한다. */
export const NUMERIC_PERCENT = /^\d+(\.\d+)?%?$/;

function tokenizeAtoms(normalized: string): string[] {
  return normalized
    .split(/[:\s]+/)
    .map((t) => t.trim())
    .filter((t) => t.length > 0 && !NUMERIC_PERCENT.test(t));
}

/**
 * 모든 깊이의 노드를 ':'·공백·'%' 수치 기준으로 쪼갠 원자 토큰(정규화된)
 * 목록으로 만든다.
 */
export function flattenAtoms(nodes: IngredientNode[]): string[] {
  const atoms: string[] = [];
  for (const node of nodes) {
    atoms.push(...tokenizeAtoms(node.normalized));
    atoms.push(...flattenAtoms(node.children));
  }
  return atoms;
}
