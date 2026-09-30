// 텍스트 정규화 (설계 10.1).
//   - 유니코드(NFKC)와 공백을 정규화한다.
//   - 영문은 소문자로 변환한다.

/**
 * 제로폭·비가시 문자 — OCR이 종종 글자 사이에 끼워 넣는다.
 *   U+200B-U+200D 제로폭 공백류, U+FEFF BOM, U+2060 단어 결합자,
 *   U+00AD 연성 하이픈(soft hyphen), U+180E 몽골어 모음 분리자.
 */
const ZERO_WIDTH_RE = /[​-‍﻿⁠­᠎]/g;

/**
 * 제로폭 문자만 제거한다. normalizeText 전체를 적용하기 전에도(예:
 * label-statements.ts가 정규식으로 절을 나누기 전) 먼저 걷어내야
 * "함유" 두 글자 사이에 제로폭 문자가 끼어 있어 정규식이 못 찾는
 * 문제를 막을 수 있다.
 */
export function stripZeroWidth(input: string): string {
  return input.replace(ZERO_WIDTH_RE, "");
}

/** NFKC 정규화, 제로폭 문자 제거, 소문자 변환, 연속 공백을 1칸으로 축소, 양끝 trim. */
export function normalizeText(input: string): string {
  return stripZeroWidth(input)
    .normalize("NFKC")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

/** normalizeText 후 공백·괄호·특수문자를 제거해 한글·영숫자만 남긴다. */
export function normalizeName(input: string): string {
  return normalizeText(input).replace(/[^\p{Script=Hangul}0-9a-z]/gu, "");
}
