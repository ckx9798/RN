// 알레르기 finding 구성과 최종 상태 판정 (설계 12.1, 12.2).

import { COPY, fillTemplate } from "./copy.ts";
import type {
  AllergenMatch,
  AllergenStandard,
  AnalysisResult,
  DataQuality,
  Finding,
  UserProfileSnapshot,
} from "./types.ts";

/**
 * 등록된 알레르기와 일치하는 매칭만 finding으로 만든다(등록하지 않은
 * 알레르기는 사용자에게 노출하지 않는다).
 */
export function buildAllergenFindings(
  matches: AllergenMatch[],
  profile: UserProfileSnapshot,
  standards: AllergenStandard[],
): Finding[] {
  const registered = new Set(profile.allergenIds);
  const byId = new Map(standards.map((s) => [s.id, s]));
  const findings: Finding[] = [];

  for (const match of matches) {
    if (!registered.has(match.allergenId)) continue;
    const standard = byId.get(match.allergenId);
    if (!standard) continue;

    if (match.kind === "cross_contamination") {
      findings.push({
        category: "cross_contamination",
        severity: "caution",
        standardId: standard.id,
        title: `${standard.name} ${COPY.allergenCrossSuffix}`,
        description: fillTemplate(COPY.allergenCrossDescription, { matchedText: match.matchedText }),
        matchedText: match.matchedText,
        source: match.source,
        evidenceUrl: standard.sourceUrl,
      });
      continue;
    }

    if (match.confidence === "confirmed") {
      findings.push({
        category: "allergen",
        severity: "caution",
        standardId: standard.id,
        title: `${standard.name} ${COPY.allergenIncludedSuffix}`,
        description: fillTemplate(COPY.allergenDirectDescription, { matchedText: match.matchedText }),
        matchedText: match.matchedText,
        source: match.source,
        evidenceUrl: standard.sourceUrl,
      });
      continue;
    }

    findings.push({
      category: "allergen",
      severity: "needs_review",
      standardId: standard.id,
      title: `${standard.name} ${COPY.allergenNeedsReviewSuffix}`,
      description: fillTemplate(COPY.allergenPossibleDescription, { matchedText: match.matchedText }),
      matchedText: match.matchedText,
      source: match.source,
      evidenceUrl: standard.sourceUrl,
    });
  }

  return findings;
}

function isQualityComplete(quality: DataQuality): boolean {
  return (
    quality.ocrReviewed &&
    quality.productMatch === "matched" &&
    quality.conflicts.length === 0 &&
    quality.missing.length === 0
  );
}

/** 우선순위: 주의 > 확인 필요 > 특이사항 없음(설계 12.1). */
export function decideStatus(findings: Finding[], quality: DataQuality): AnalysisResult["status"] {
  if (findings.some((f) => f.severity === "caution")) return "caution";
  if (findings.some((f) => f.severity === "needs_review")) return "needs_review";
  if (!isQualityComplete(quality)) return "needs_review";
  return "no_flags";
}
