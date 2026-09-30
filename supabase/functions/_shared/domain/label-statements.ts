// 알레르기 표시 문구 / 교차혼입 문구 추출 (설계 10.1, 브리프 Step 4).
//
// scan 필드가 이미 채워져 있으면 그대로 쓴다. 비어 있을 때만 ingredientsText,
// 그 다음 rawText에서 문장을 분리해 찾는다. ingredientsText에서 찾은 문장은
// ingredientsBody에서 제거한다(rawText에서 찾은 문장은 ingredientsText의
// 일부가 아니므로 ingredientsBody를 건드리지 않는다).

import type { ScanPayload } from "./types.ts";

const CROSS_CONTAMINATION_RE = /(같은|동일한)\s*(제조)?\s*시설|혼입\s*가능/;
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

function splitSentences(text: string): string[] {
  return text
    .split(/[.\n。]/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

function isBlank(value: string | null): value is null {
  return value === null || value.trim().length === 0;
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
    for (const sentence of sentences) {
      if (needsCross && crossContamination === null && CROSS_CONTAMINATION_RE.test(sentence)) {
        crossContamination = sentence;
        continue;
      }
      if (needsAllergen && allergen === null && ALLERGEN_RE.test(sentence)) {
        allergen = sentence;
        continue;
      }
      remaining.push(sentence);
    }
    if (remaining.length !== sentences.length) {
      ingredientsBody = remaining.join("\n");
    }
  }

  if ((allergen === null || crossContamination === null) && scan.rawText.trim().length > 0) {
    const sentences = splitSentences(scan.rawText);
    for (const sentence of sentences) {
      if (crossContamination === null && CROSS_CONTAMINATION_RE.test(sentence)) {
        crossContamination = sentence;
        continue;
      }
      if (allergen === null && ALLERGEN_RE.test(sentence)) {
        allergen = sentence;
      }
    }
  }

  return { allergen, crossContamination, ingredientsBody };
}
