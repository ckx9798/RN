// 알레르기 매처 (설계 10.2).
//
// 매칭 순서:
//   1. 알레르기 공식 표시 문구 (label_context 용어는 여기서만 확정)
//   2. 함유 등 직접 문맥 — statement 필드는 모든 match_type을 exact/포함
//      비교로 처리한다.
//   3. 정확 원재료 토큰 및 확정 별칭 (exact_token)
//   4. 복합원재료 내부 확정 별칭 (phrase, 중첩 괄호를 포함한 모든 깊이)
//   5. 교차혼입 문구
//   6. 오탐 가능성이 있는 간접 별칭 (confidence: possible)
//
// [S2 리뷰 2차 수정 — 구조 변경]
//   - direct 판정은 ingredientsText(본문 토크나이저) + allergenStatement
//     (문장 토크나이저) + crossContaminationStatement 중 교차혼입 지배
//     항목 목록을 뺀 나머지(문장 토크나이저)를 모두 훑는다. 호출자가
//     crossContaminationStatement를 직접 줬을 때도(추출을 거치지 않아도)
//     label-statements.ts의 splitCrossClauses로 같은 절 분리를 적용한다.
//   - cross는 순수 가산적이다: 같은 allergenId가 direct로도 잡히면
//     cross 결과는 버린다(절대 direct를 cross로 격하하지 않는다).

import { flattenAtoms, isDigit, NUMERIC_PERCENT, parseIngredients } from "./ingredient-parser.ts";
import { splitCrossClauses } from "./label-statements.ts";
import { normalizeText } from "./normalize.ts";
import type { AllergenMatch, AllergenTerm, IngredientNode } from "./types.ts";

/**
 * 부정 합성어: phrase 매칭에서 원자 토큰이 이 목록의 단어를 포함하면
 * 해당 phrase 용어는 매칭하지 않는다(예: "메밀가루"는 "밀가루"의 phrase
 * 매칭에서, "새우육수"는 "우육"의 phrase 매칭에서 제외).
 */
export const NEGATIVE_COMPOUNDS: Record<string, string[]> = {
  "밀가루": ["메밀가루"],
  "밀분": ["메밀분"],
  "밀전분": ["메밀전분"],
  "우육": ["새우육"],
};

const PARTICLES = ["으로", "을", "를", "이", "가", "와", "과", "및", "등", "은", "는", "로"];

/**
 * 용어 사이를 잇는 접속 조사. "밀과콩함유", "게와새우함유"처럼 공백·쉼표
 * 없이 여러 항목이 붙어 있을 때, 1글자 exact_token 용어(게/밀/콩/잣/굴)는
 * 부분 문자열 비교를 하지 않으므로 이 조사로 쪼개서 각 조각을 다시
 * 비교해야 찾을 수 있다.
 */
const CONNECTIVE_RE = /또는|이나|와|과|및/;

/**
 * 표시 문구에서 용어 뒤에 붙는 서술어. "함유"/"포함"이 처음 나타나는
 * 위치에서 자른다(예: "밀함유" -> "밀", "밀함유됨" -> "밀"). 조사 제거
 * 보다 먼저 적용한다.
 */
const CUE_WORD_RE = /함유|포함/;

function truncateAtCueWord(token: string): string {
  const match = CUE_WORD_RE.exec(token);
  if (match && match.index > 0) return token.slice(0, match.index);
  return token;
}

function stripParticle(token: string): string {
  for (const particle of PARTICLES) {
    if (token.length > particle.length && token.endsWith(particle)) {
      return token.slice(0, token.length - particle.length);
    }
  }
  return token;
}

/** 접속 조사로 쪼갠 조각들(조사 제거까지 적용). 원 토큰은 포함하지 않는다. */
function splitConnectivePieces(token: string): string[] {
  return token
    .split(CONNECTIVE_RE)
    .map((piece) => stripParticle(piece.trim()))
    .filter((piece) => piece.length > 0);
}

type MatchInput = {
  ingredientsText: string | null;
  allergenStatement: string | null;
  crossContaminationStatement: string | null;
  source: "label" | "mfds_api";
};

type Candidate = {
  allergenId: string;
  term: string;
  matchedText: string;
  kind: AllergenMatch["kind"];
  matchType: AllergenMatch["matchType"];
  confidence: AllergenMatch["confidence"];
};

// normalizeText가 NFKC를 적용한 뒤이므로 ㆍ(U+318D)는 이미 U+119E로
// 바뀌어 있다. 두 형태를 모두 넣어 안전하게 처리한다. '.'은 소수점
// 보호가 필요해 별도로 처리한다(아래 splitStatementTokens).
const STATEMENT_SEPARATOR_CHARS = /[,，、·ㆍᆞ‧/\n\r()[\]:;|【】{}<>「」\-+&\s]/;

/** 문장을 구분자 기준으로 쪼갠다. 숫자 사이의 '.'(소수점)은 보존한다. */
function splitStatementTokens(normalized: string): string[] {
  const chars = [...normalized];
  const segments: string[] = [];
  let current = "";

  for (let i = 0; i < chars.length; i += 1) {
    const ch = chars[i];
    if (ch === ".") {
      const isDecimal = isDigit(chars[i - 1]) && isDigit(chars[i + 1]);
      if (!isDecimal) {
        segments.push(current);
        current = "";
        continue;
      }
      current += ch;
      continue;
    }
    if (STATEMENT_SEPARATOR_CHARS.test(ch)) {
      segments.push(current);
      current = "";
      continue;
    }
    current += ch;
  }
  segments.push(current);

  return segments.filter((s) => s.length > 0);
}

/** 문장(공식 표시 문구·교차혼입 문구)을 구분자·공백·조사·서술어 기준으로 토큰화한다. */
function tokenizeStatement(text: string): string[] {
  const normalized = normalizeText(text);
  const rough = splitStatementTokens(normalized);
  return rough.map((t) => stripParticle(truncateAtCueWord(t))).filter((t) => t.length > 0);
}

/**
 * phrase 매칭용 원자 후보. flattenAtoms(공백까지 분리)와 달리 콜론
 * 기준으로만 나누고 공백은 보존한다 — "sulfur dioxide"처럼 공백을 포함한
 * 영문 phrase 용어를 잃지 않기 위함이다. 퍼센트 수치 낱말은 제거한다.
 */
function collectPhraseCandidates(nodes: IngredientNode[]): string[] {
  const candidates: string[] = [];
  for (const node of nodes) {
    for (const colonPart of node.normalized.split(":")) {
      const words = colonPart.split(/\s+/).filter((w) => w.length > 0 && !NUMERIC_PERCENT.test(w));
      const phrase = words.join(" ").trim();
      if (phrase.length > 0) candidates.push(phrase);
    }
    candidates.push(...collectPhraseCandidates(node.children));
  }
  return candidates;
}

function matchIngredientAtoms(text: string, terms: AllergenTerm[]): Candidate[] {
  const nodes = parseIngredients(text);
  const exactAtoms = flattenAtoms(nodes);
  const phraseCandidates = collectPhraseCandidates(nodes);
  const candidates: Candidate[] = [];

  for (const term of terms) {
    if (term.matchType === "label_context") continue; // 공식 표시 문구 문맥에서만 확정
    const normalizedTerm = normalizeText(term.term);

    if (term.matchType === "exact_token") {
      for (const atom of exactAtoms) {
        if (atom === normalizedTerm) {
          candidates.push({
            allergenId: term.allergenId,
            term: term.term,
            matchedText: atom,
            kind: "direct",
            matchType: term.matchType,
            confidence: term.confidence,
          });
        }
      }
      continue;
    }

    // phrase
    for (const candidate of phraseCandidates) {
      if (!candidate.includes(normalizedTerm)) continue;
      const negatives = NEGATIVE_COMPOUNDS[term.term] ?? [];
      const blocked = negatives.some((neg) => candidate.includes(normalizeText(neg)));
      if (blocked) continue;
      candidates.push({
        allergenId: term.allergenId,
        term: term.term,
        matchedText: candidate,
        kind: "direct",
        matchType: term.matchType,
        confidence: term.confidence,
      });
    }
  }

  return dedupeLongerPhraseWins(candidates);
}

/**
 * 같은 원자 토큰(matchedText)에 대해 phrase로 매칭된 여러 용어 중 한
 * 용어 문자열이 다른 용어 문자열의 부분 문자열이면 더 긴 쪽만 남긴다.
 * 시드에 같은 기준 안에서 겹치는 phrase 용어(예: FOOD-003의 "메밀"과
 * "메밀가루")가 실제로 있어 이 로직이 실행된다 — 다만 지금까지 확인된
 * 겹침은 전부 같은 allergenId 안에서만 일어나(교차 기준 겹침은
 * NEGATIVE_COMPOUNDS로 따로 막는다) 최종 판정에는 영향이 없다(중복
 * 제거 효과만 있다).
 */
function dedupeLongerPhraseWins(candidates: Candidate[]): Candidate[] {
  const result: Candidate[] = [];
  for (const candidate of candidates) {
    if (candidate.matchType !== "phrase") {
      result.push(candidate);
      continue;
    }
    const shadowedByLonger = candidates.some((other) =>
      other !== candidate &&
      other.matchType === "phrase" &&
      other.matchedText === candidate.matchedText &&
      other.term.length > candidate.term.length &&
      other.term.includes(candidate.term)
    );
    if (!shadowedByLonger) result.push(candidate);
  }
  return result;
}

function matchStatement(
  text: string,
  terms: AllergenTerm[],
  kind: AllergenMatch["kind"],
): Candidate[] {
  const tokens = tokenizeStatement(text);
  const candidates: Candidate[] = [];

  for (const token of tokens) {
    const connectivePieces = splitConnectivePieces(token);

    for (const term of terms) {
      const normalizedTerm = normalizeText(term.term);

      if (term.matchType === "phrase") {
        if (!token.includes(normalizedTerm)) continue;
        const negatives = NEGATIVE_COMPOUNDS[term.term] ?? [];
        const blocked = negatives.some((neg) => token.includes(normalizeText(neg)));
        if (blocked) continue;
        candidates.push({
          allergenId: term.allergenId,
          term: term.term,
          matchedText: token,
          kind,
          matchType: "statement",
          confidence: term.confidence,
        });
        continue;
      }

      // exact_token 또는 label_context: 토큰 전체, 또는 접속 조사로
      // 쪼갠 조각 중 하나가 정확히 일치해야 한다("밀과콩함유"의 "밀"·"콩").
      const matched = token === normalizedTerm ||
        connectivePieces.some((piece) => piece === normalizedTerm);
      if (!matched) continue;
      candidates.push({
        allergenId: term.allergenId,
        term: term.term,
        matchedText: token,
        kind,
        matchType: "statement",
        confidence: term.confidence,
      });
    }
  }

  return dedupeLongerPhraseWins(candidates);
}

/**
 * crossContaminationStatement 필드를 절 단위로 분리해 매칭한다. 이
 * 필드는 label-statements.ts의 추출 결과일 수도 있고(이미 지배 항목
 * 목록만 담겨 있다) 호출자가 원문 그대로 줬을 수도 있다(F1 사례처럼
 * 함유 절이 섞여 있을 수 있다) — 출처와 무관하게 동일한 절 분리를
 * 적용해, 트리거가 지배하는 항목만 cross로, 나머지는 direct로 본다.
 */
function matchCrossContaminationStatement(text: string, terms: AllergenTerm[]): Candidate[] {
  const { crossSpans, remainder } = splitCrossClauses(text);
  const candidates: Candidate[] = [];

  if (crossSpans.length > 0) {
    candidates.push(...matchStatement(crossSpans.join(", "), terms, "cross_contamination"));
    if (remainder.length > 0) {
      candidates.push(...matchStatement(remainder, terms, "direct"));
    }
  } else {
    // 트리거를 하나도 못 찾았으면 필드 전체를 기존처럼 교차혼입으로 본다.
    candidates.push(...matchStatement(text, terms, "cross_contamination"));
  }

  return candidates;
}

/** (allergenId, kind, source) 별로 confirmed 우선 1건으로 합친다. */
function mergeCandidates(
  candidates: Candidate[],
  source: "label" | "mfds_api",
): AllergenMatch[] {
  const groups = new Map<string, Candidate[]>();
  for (const candidate of candidates) {
    const key = `${candidate.allergenId}|${candidate.kind}`;
    const list = groups.get(key) ?? [];
    list.push(candidate);
    groups.set(key, list);
  }

  const merged: AllergenMatch[] = [];
  for (const list of groups.values()) {
    const confirmed = list.find((c) => c.confidence === "confirmed");
    const chosen = confirmed ?? list[0];
    merged.push({
      allergenId: chosen.allergenId,
      term: chosen.term,
      matchedText: chosen.matchedText,
      kind: chosen.kind,
      source,
      matchType: chosen.matchType,
      confidence: chosen.confidence,
    });
  }
  return merged;
}

/**
 * cross는 순수 가산적이다: 같은 allergenId가 direct로 이미 잡혔으면
 * cross 항목은 버린다. 절대 direct를 cross로 격하하지 않는다.
 */
function suppressCrossWhenDirectExists(matches: AllergenMatch[]): AllergenMatch[] {
  const directIds = new Set(matches.filter((m) => m.kind === "direct").map((m) => m.allergenId));
  return matches.filter((m) => m.kind !== "cross_contamination" || !directIds.has(m.allergenId));
}

export function matchAllergens(input: MatchInput, terms: AllergenTerm[]): AllergenMatch[] {
  const candidates: Candidate[] = [];

  if (input.ingredientsText && input.ingredientsText.trim().length > 0) {
    candidates.push(...matchIngredientAtoms(input.ingredientsText, terms));
  }

  if (input.allergenStatement && input.allergenStatement.trim().length > 0) {
    candidates.push(...matchStatement(input.allergenStatement, terms, "direct"));
  }

  if (input.crossContaminationStatement && input.crossContaminationStatement.trim().length > 0) {
    candidates.push(...matchCrossContaminationStatement(input.crossContaminationStatement, terms));
  }

  return suppressCrossWhenDirectExists(mergeCandidates(candidates, input.source));
}
