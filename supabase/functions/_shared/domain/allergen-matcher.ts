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

import { flattenAtoms, NUMERIC_PERCENT, parseIngredients } from "./ingredient-parser.ts";
import { normalizeText } from "./normalize.ts";
import type { AllergenMatch, AllergenTerm, IngredientNode } from "./types.ts";

/**
 * 부정 합성어: phrase 매칭에서 원자 토큰이 이 목록의 단어를 포함하면
 * 해당 phrase 용어는 매칭하지 않는다(예: "메밀가루"는 "밀가루"의 phrase
 * 매칭에서 제외).
 */
export const NEGATIVE_COMPOUNDS: Record<string, string[]> = {
  "밀가루": ["메밀가루"],
  "밀분": ["메밀분"],
  "밀전분": ["메밀전분"],
};

const PARTICLES = ["으로", "을", "를", "이", "가", "와", "과", "및", "등", "은", "는", "로"];

/**
 * 표시 문구에서 용어 뒤에 공백 없이 붙는 서술어. 조사 제거보다 먼저
 * 떼어낸다(예: "밀함유" -> "밀", "대두포함" -> "대두"). 긴 것부터 검사한다.
 */
const CUE_SUFFIXES = ["함유함", "함유", "포함"];

function stripCueSuffix(token: string): string {
  for (const suffix of CUE_SUFFIXES) {
    if (token.length > suffix.length && token.endsWith(suffix)) {
      return token.slice(0, token.length - suffix.length);
    }
  }
  return token;
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

function stripParticle(token: string): string {
  for (const particle of PARTICLES) {
    if (token.length > particle.length && token.endsWith(particle)) {
      return token.slice(0, token.length - particle.length);
    }
  }
  return token;
}

// normalizeText가 NFKC를 적용한 뒤이므로 ㆍ(U+318D)는 이미 U+119E로
// 바뀌어 있다. 두 형태를 모두 넣어 안전하게 처리한다.
const STATEMENT_SEPARATORS =
  /[,，、·ㆍᆞ‧/\n\r()\[\]:;|【】{}<>「」\s]+/;

/** 문장(공식 표시 문구·교차혼입 문구)을 구분자·공백·조사 기준으로 토큰화한다. */
function tokenizeStatement(text: string): string[] {
  const normalized = normalizeText(text);
  const rough = normalized.split(STATEMENT_SEPARATORS).filter((t) => t.length > 0);
  return rough.map((t) => stripParticle(stripCueSuffix(t))).filter((t) => t.length > 0);
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
 * 같은 원자 토큰에 대해 phrase로 매칭된 여러 용어 중 한 용어 문자열이
 * 다른 용어 문자열의 부분 문자열이면 더 긴 쪽만 남긴다.
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
    for (const term of terms) {
      const normalizedTerm = normalizeText(term.term);
      const isMatch = term.matchType === "phrase"
        ? token.includes(normalizedTerm)
        : token === normalizedTerm;
      if (!isMatch) continue;
      if (term.matchType === "phrase") {
        const negatives = NEGATIVE_COMPOUNDS[term.term] ?? [];
        const blocked = negatives.some((neg) => token.includes(normalizeText(neg)));
        if (blocked) continue;
      }
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

export function matchAllergens(input: MatchInput, terms: AllergenTerm[]): AllergenMatch[] {
  const candidates: Candidate[] = [];

  if (input.ingredientsText && input.ingredientsText.trim().length > 0) {
    candidates.push(...matchIngredientAtoms(input.ingredientsText, terms));
  }

  if (input.allergenStatement && input.allergenStatement.trim().length > 0) {
    candidates.push(...matchStatement(input.allergenStatement, terms, "direct"));
  }

  if (input.crossContaminationStatement && input.crossContaminationStatement.trim().length > 0) {
    candidates.push(...matchStatement(input.crossContaminationStatement, terms, "cross_contamination"));
  }

  return mergeCandidates(candidates, input.source);
}
