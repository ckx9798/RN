// 알레르기 표시 문구 / 교차혼입 문구 추출 (설계 10.1, 브리프 Step 4).
//
// 이 모듈은 문장을 "어느 필드로 보낼지"만 정한다. direct/cross 판정 자체는
// allergen-matcher.ts가 모든 필드에 같은 규칙(cross-spans.ts, 룰링 R13)을
// 적용해 내린다 — 그래서 어떤 문장이 어느 필드에 들어가도 결과가 같다.
//
//   - 교차혼입 트리거가 있는 문장 → crossContamination(필드가 비어 있을
//     때만. 이미 주어졌으면 본문에 남겨 두어도 매처가 R13으로 나눈다).
//   - 함유/알레르기 단서가 있는 문장 → allergen(필드가 비어 있을 때만).
//     본문에서 빼지 않는다(규칙 d).
//   - rawText도 ingredientsText와 똑같이 처리한다(룰링 D) — 트리거 문장은
//     교차혼입 쪽으로, 나머지는 본문에 더한다.
//   - 정규식 전에 제로폭 문자를 먼저 걷어낸다.

import { isDigit } from "./ingredient-parser.ts";
import { hasCrossTrigger } from "./cross-spans.ts";
import { stripZeroWidth } from "./normalize.ts";
import type { ScanPayload } from "./types.ts";

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

export function extractStatements(scan: StatementInput): ExtractResult {
  const givenAllergen = isBlank(scan.allergenStatement) ? null : stripZeroWidth(scan.allergenStatement);
  const givenCross = isBlank(scan.crossContaminationStatement)
    ? null
    : stripZeroWidth(scan.crossContaminationStatement);

  const sentences = [
    ...splitSentences(stripZeroWidth(scan.ingredientsText)),
    ...splitSentences(stripZeroWidth(scan.rawText)),
  ];
  const crossSentences = givenCross === null ? sentences.filter(hasCrossTrigger) : [];
  const body = sentences.filter((s) => !crossSentences.includes(s));
  const cueSentences = body.filter((s) => ALLERGEN_CUE_RE.test(s));

  return {
    allergen: givenAllergen ?? (cueSentences.length > 0 ? cueSentences.join("\n") : null),
    crossContamination: givenCross ?? (crossSentences.length > 0 ? crossSentences.join("\n") : null),
    ingredientsBody: body.join("\n"),
  };
}
