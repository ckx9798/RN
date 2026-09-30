// 원재료 텍스트 파서 (설계 10.1).
//   - 쉼표, 가운데점, 슬래시, 줄바꿈을 구분자로 인식한다.
//   - 대괄호와 소괄호의 중첩을 보존해 복합원재료를 파싱한다.
//   - 짝이 맞지 않는 괄호도 예외 없이 처리한다.

import { normalizeText } from "./normalize.ts";
import type { IngredientNode } from "./types.ts";

const TOP_LEVEL_SEPARATORS = /[,，、·/\n\r]/;
const OPEN_BRACKETS = new Set(["(", "["]);
const CLOSE_BRACKETS = new Set([")", "]"]);

/** 최상위 구분자로 텍스트를 나눈다. 괄호 안의 구분자는 무시한다(깊이 추적). */
function splitTopLevel(text: string): string[] {
  const segments: string[] = [];
  let depth = 0;
  let current = "";

  for (const ch of text) {
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

const NUMERIC_PERCENT = /^\d+(\.\d+)?%?$/;

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
