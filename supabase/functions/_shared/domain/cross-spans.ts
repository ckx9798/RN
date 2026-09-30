// 교차혼입 지배 목록 판정 (룰링 R13).
//
// 교차혼입 트리거가 "지배하는" 항목은 트리거에 맞닿은, "정확히 알레르기
// 용어인 토큰"들의 최대 연속 목록뿐이다.
//   - 항목: 조사("와/과/을/를/등" 등)를 뗀 단어가 용어와 정확히 같아야
//     한다. 용어에 붙은 괄호 묶음("조개류(굴, 홍합)")은 그 항목의
//     일부이며, 괄호 안도 전부 용어여야 한다("밀가루(밀 100%)"는 항목이
//     아니다).
//   - 항목 사이는 목록 구분자(, ， ㆍ · / 및 와 과 등, 공백)로만 이어진다.
//   - 용어가 아닌 첫 토큰(또는 줄바꿈·마침표·콜론·'|'·'-' 같은 경계
//     문자, 괄호 바깥)에서 목록이 끝난다.
//   - 방향: "X와/과 같은/동일한 (제조)시설", "X을/를 사용한 제품과 같은
//     …", "X 혼입 가능(성)"은 트리거 앞(뒤로 훑는다). "같은/동일한
//     (제조)시설에서 X, Y…", "혼입 가능(성): X, Y"는 트리거 뒤(앞으로
//     훑는다).
// 지배 목록에 들지 않은 텍스트는 전부 direct 판정 대상이다.

import { stripZeroWidth } from "./normalize.ts";

const JOIN = "\uE000"; // 공백을 포함한 용어("sulfur dioxide")를 한 단어로 묶는 내부 문자

const LIST_SEPARATOR_CHARS = new Set([" ", ",", "、", "·", "ㆍ", "ᆞ", "‧", "/"]);
const LIST_SEPARATOR_WORDS = new Set(["및", "와", "과", "등"]);
const OPEN_BRACKETS = new Set(["(", "["]);
const CLOSE_BRACKETS = new Set([")", "]"]);
const CUE_WORDS = new Set(["포함", "함유"]);
// 항목의 바깥쪽(트리거 반대편) 경계로 인정하는 문자. 목록 구분자 외에는
// 문장 경계와 괄호만 허용한다 — "원재료명:밀가루"처럼 ':' '|' '-' 등이
// 붙은 토큰은 용어와 "정확히" 같은 토큰이 아니다.
const OUTER_EDGE_BEFORE = new Set(["\n", ".", "。", "(", "["]);
const OUTER_EDGE_AFTER = new Set(["\n", ".", "。", ")", "]"]);
const CUE_SUFFIX_RE = /(함유|포함)$/;

export const PARTICLES = ["으로", "을", "를", "이", "가", "와", "과", "및", "등", "은", "는", "로"];

export function stripParticle(token: string): string {
  for (const particle of PARTICLES) {
    if (token.length > particle.length && token.endsWith(particle)) {
      return token.slice(0, token.length - particle.length);
    }
  }
  return token;
}

const FACILITY = "(같은|동일한?) *(제조)? *시설";
/** 트리거 앞의 목록을 지배하는 형태. 매치 시작 위치가 목록의 끝이다. */
const BACKWARD_TRIGGERS = [
  new RegExp(`(을|를)? *사용(한|하는)? *제품과 *${FACILITY}`, "g"),
  new RegExp(`(와|과) *${FACILITY}`, "g"),
  /혼입 *(될 *)?가능/g,
];
/** 트리거 뒤의 목록을 지배하는 형태. 매치 끝 위치가 목록의 시작이다. */
const FORWARD_TRIGGERS = [
  new RegExp(`${FACILITY} *에서`, "g"),
  /혼입 *가능성? *(있음)? *:/g,
];

/** NFKC·소문자·제로폭 제거, 줄바꿈은 보존하고 나머지 공백만 1칸으로. */
function normalizeKeepLines(text: string): string {
  return stripZeroWidth(text)
    .normalize("NFKC")
    .toLowerCase()
    .replace(/\r\n?/g, "\n")
    .replace(/[^\S\n]+/g, " ");
}

function isWordChar(ch: string | undefined): boolean {
  if (ch === undefined || LIST_SEPARATOR_CHARS.has(ch)) return false;
  return ch === JOIN || ch === "%" || /[\p{L}\p{N}\p{M}]/u.test(ch);
}

type Range = [number, number];

class SpanScanner {
  private readonly termSet: Set<string>;
  readonly text: string;

  constructor(text: string, terms: string[]) {
    this.termSet = new Set(terms.map((t) => t.replace(/ /g, JOIN)));
    let s = normalizeKeepLines(text);
    for (const term of terms) {
      if (term.includes(" ")) s = s.split(term).join(term.replace(/ /g, JOIN));
    }
    // "조개류를사용한"처럼 붙은 서술어를 떼어 마지막 항목이 온전한 토큰이 되게 한다.
    this.text = s.replace(/(을|를)(?=사용)/g, "$1 ");
  }

  /** 조사를 최대 두 번까지 떼어 용어와 정확히 같은지 본다("땅콩등을" → 땅콩). */
  private isTermWord(word: string): boolean {
    if (word.length === 0) return false;
    const once = stripParticle(word);
    return this.termSet.has(word) || this.termSet.has(once) || this.termSet.has(stripParticle(once));
  }

  /** 괄호 안: 모든 토큰이 용어여야 한다("포함/함유" 단독 토큰·접미사는 허용). */
  private isTermBracket(content: string): boolean {
    const tokens = content.split(/[ ,、·ㆍᆞ‧/]+/).filter((t) => t.length > 0);
    let found = 0;
    for (const raw of tokens) {
      if (LIST_SEPARATOR_WORDS.has(raw) || CUE_WORDS.has(raw)) continue;
      const token = raw.replace(CUE_SUFFIX_RE, "");
      if (![...token].every(isWordChar) || !this.isTermWord(token)) return false;
      found += 1;
    }
    return found > 0;
  }

  private readWordBackward(end: number): number {
    let i = end;
    while (i > 0 && isWordChar(this.text[i - 1])) i -= 1;
    return i;
  }

  private readWordForward(start: number): number {
    let i = start;
    while (i < this.text.length && isWordChar(this.text[i])) i += 1;
    return i;
  }

  private matchOpenBackward(closeIndex: number): number {
    let depth = 0;
    for (let i = closeIndex; i >= 0; i -= 1) {
      if (CLOSE_BRACKETS.has(this.text[i])) depth += 1;
      else if (OPEN_BRACKETS.has(this.text[i])) {
        depth -= 1;
        if (depth === 0) return i;
      }
    }
    return -1;
  }

  private matchCloseForward(openIndex: number): number {
    let depth = 0;
    for (let i = openIndex; i < this.text.length; i += 1) {
      if (OPEN_BRACKETS.has(this.text[i])) depth += 1;
      else if (CLOSE_BRACKETS.has(this.text[i])) {
        depth -= 1;
        if (depth === 0) return i;
      }
    }
    return -1;
  }

  /** end 바로 앞의 항목 하나. 용어 항목이 아니면 null. */
  private itemBackward(end: number): Range | null {
    const s = this.text;
    const tailStart = this.readWordBackward(end);
    const tail = s.slice(tailStart, end);
    const bracketBefore = CLOSE_BRACKETS.has(s[tailStart - 1]);
    if (bracketBefore && (tail.length === 0 || PARTICLES.includes(tail))) {
      const open = this.matchOpenBackward(tailStart - 1);
      if (open < 0) return null;
      const headStart = this.readWordBackward(open);
      const head = s.slice(headStart, open);
      if (!this.isTermWord(head) || !this.isTermBracket(s.slice(open + 1, tailStart - 1))) return null;
      return [headStart, end];
    }
    return this.isTermWord(tail) ? [tailStart, end] : null;
  }

  /** start에서 시작하는 항목 하나. 용어 항목이 아니면 null. */
  private itemForward(start: number): Range | null {
    const s = this.text;
    const headEnd = this.readWordForward(start);
    const head = s.slice(start, headEnd);
    if (!OPEN_BRACKETS.has(s[headEnd])) return this.isTermWord(head) ? [start, headEnd] : null;
    const close = this.matchCloseForward(headEnd);
    if (close < 0) return null;
    if (!this.isTermWord(head) || !this.isTermBracket(s.slice(headEnd + 1, close))) return null;
    const tailEnd = this.readWordForward(close + 1);
    const tail = s.slice(close + 1, tailEnd);
    return [start, PARTICLES.includes(tail) ? tailEnd : close + 1];
  }

  /** 목록 구분자(문자·단독 낱말)를 건너뛴 위치. 구분자가 없으면 그대로. */
  private skipSeparatorsBackward(end: number): number {
    let i = end;
    for (;;) {
      if (i > 0 && LIST_SEPARATOR_CHARS.has(this.text[i - 1])) {
        i -= 1;
        continue;
      }
      const wordStart = this.readWordBackward(i);
      const word = this.text.slice(wordStart, i);
      if (i < end && LIST_SEPARATOR_WORDS.has(word) && !isWordChar(this.text[wordStart - 1])) {
        i = wordStart;
        continue;
      }
      return i;
    }
  }

  private skipSeparatorsForward(start: number): number {
    let i = start;
    for (;;) {
      if (i < this.text.length && LIST_SEPARATOR_CHARS.has(this.text[i])) {
        i += 1;
        continue;
      }
      const wordEnd = this.readWordForward(i);
      const word = this.text.slice(i, wordEnd);
      if (i > start && LIST_SEPARATOR_WORDS.has(word) && LIST_SEPARATOR_CHARS.has(this.text[wordEnd])) {
        i = wordEnd;
        continue;
      }
      return i;
    }
  }

  private isEdge(index: number, edges: Set<string>): boolean {
    const ch = this.text[index];
    return ch === undefined || LIST_SEPARATOR_CHARS.has(ch) || edges.has(ch);
  }

  governedBackward(listEnd: number): Range[] {
    const items: Range[] = [];
    let i = listEnd;
    while (i > 0 && this.text[i - 1] === " ") i -= 1;
    for (;;) {
      const item = this.itemBackward(i);
      if (!item || !this.isEdge(item[0] - 1, OUTER_EDGE_BEFORE)) break;
      items.push(item);
      const next = this.skipSeparatorsBackward(item[0]);
      if (next === item[0]) break;
      i = next;
    }
    return items;
  }

  governedForward(listStart: number): Range[] {
    const items: Range[] = [];
    let i = listStart;
    while (i < this.text.length && this.text[i] === " ") i += 1;
    for (;;) {
      const item = this.itemForward(i);
      if (!item || !this.isEdge(item[1], OUTER_EDGE_AFTER)) break;
      items.push(item);
      const next = this.skipSeparatorsForward(item[1]);
      if (next === item[1]) break;
      i = next;
    }
    return items;
  }
}

export type CrossSplit = {
  /** 텍스트에 교차혼입 트리거가 하나라도 있었는지. */
  hasTrigger: boolean;
  /** 지배 목록의 항목(정규화된 원문, 괄호 묶음 포함). */
  crossItems: string[];
  /** 지배 항목을 뺀 나머지 전부(정규화됨) — direct 판정 대상. */
  directText: string;
};

function findAll(re: RegExp, text: string): RegExpExecArray[] {
  re.lastIndex = 0;
  return [...text.matchAll(re)];
}

/** 텍스트에 교차혼입 트리거가 있는지(문장 분류용). */
export function hasCrossTrigger(text: string): boolean {
  const s = normalizeKeepLines(text);
  return [...BACKWARD_TRIGGERS, ...FORWARD_TRIGGERS].some((re) => findAll(re, s).length > 0);
}

/**
 * R13: 텍스트를 교차혼입 지배 항목과 나머지(direct)로 나눈다.
 * terms는 normalizeText로 정규화한 알레르기 용어 문자열 목록이다.
 */
export function splitCrossSpans(text: string, terms: string[]): CrossSplit {
  const scanner = new SpanScanner(text, terms);
  const s = scanner.text;
  const ranges: Range[] = [];
  let hasTrigger = false;

  const forwardColonStarts = new Set(findAll(FORWARD_TRIGGERS[1], s).map((m) => m.index));
  for (const re of BACKWARD_TRIGGERS) {
    for (const m of findAll(re, s)) {
      hasTrigger = true;
      // "혼입 가능(성): X"는 목록이 트리거 뒤에 오는 형태다 — 앞은 훑지 않는다.
      if (re === BACKWARD_TRIGGERS[2] && forwardColonStarts.has(m.index)) continue;
      ranges.push(...scanner.governedBackward(m.index));
    }
  }
  for (const re of FORWARD_TRIGGERS) {
    for (const m of findAll(re, s)) {
      hasTrigger = true;
      ranges.push(...scanner.governedForward(m.index + m[0].length));
    }
  }

  ranges.sort((a, b) => a[0] - b[0]);
  const crossItems: string[] = [];
  let direct = "";
  let cursor = 0;
  for (const [start, end] of ranges) {
    if (start < cursor) continue; // 겹치는 항목(같은 항목을 두 트리거가 지배)
    crossItems.push(s.slice(start, end));
    direct += `${s.slice(cursor, start)}\n`;
    cursor = end;
  }
  direct += s.slice(cursor);

  const unjoin = (value: string) => value.split(JOIN).join(" ");
  return { hasTrigger, crossItems: crossItems.map(unjoin), directText: unjoin(direct) };
}
