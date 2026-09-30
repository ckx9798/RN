// 텍스트 정규화 (설계 10.1).
//   - 유니코드(NFKC)와 공백을 정규화한다.
//   - 영문은 소문자로 변환한다.

/** NFKC 정규화, 소문자 변환, 연속 공백을 1칸으로 축소, 양끝 trim. */
export function normalizeText(input: string): string {
  return input
    .normalize("NFKC")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

/** normalizeText 후 공백·괄호·특수문자를 제거해 한글·영숫자만 남긴다. */
export function normalizeName(input: string): string {
  return normalizeText(input).replace(/[^\p{Script=Hangul}0-9a-z]/gu, "");
}
