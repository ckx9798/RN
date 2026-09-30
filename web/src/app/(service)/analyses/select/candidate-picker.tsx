"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { createBrowserSupabase } from "@/lib/supabase/client";
import { analyzeFood, searchFoodCandidates } from "@/lib/analysis/analyze-client";
import type { ProductCandidate } from "@/lib/analysis/types";
import { useScanSession } from "@/components/scan-session-provider";
import styles from "../analyses.module.css";

const SEARCH_ERROR_MESSAGE = "검색하지 못했어요. 잠시 후 다시 시도해 주세요.";
const SELECT_ERROR_MESSAGE = "선택한 제품으로 다시 분석하지 못했어요. 잠시 후 다시 시도해 주세요.";
const MIN_QUERY_LENGTH = 2;

/**
 * 후보 선택 UI. `pending`이 없으면(예: 새로고침으로 메모리 상태가
 * 사라진 경우) 홈으로 되돌린다(작업 브리프 W3 Step 3).
 */
export function CandidatePicker() {
  const router = useRouter();
  const supabase = useRef(createBrowserSupabase()).current;
  const { pending, setPending } = useScanSession();

  const [query, setQuery] = useState("");
  const [manualResults, setManualResults] = useState<ProductCandidate[] | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!pending) {
      router.replace("/");
    }
  }, [pending, router]);

  if (!pending) {
    return null;
  }

  const candidates = manualResults ?? pending.candidates;

  async function handleSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const trimmed = query.trim();
    if (trimmed.length < MIN_QUERY_LENGTH || !pending) {
      return;
    }

    setIsSearching(true);
    setErrorMessage(null);

    const result = await searchFoodCandidates(supabase, trimmed, pending.scan.manufacturer);

    setIsSearching(false);

    if (!result.ok) {
      setErrorMessage(SEARCH_ERROR_MESSAGE);
      return;
    }

    setManualResults(result.candidates);
  }

  async function selectCandidate(candidateId: string) {
    if (isSubmitting || !pending) {
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);

    const result = await analyzeFood(supabase, {
      scan: pending.scan,
      selectedProductId: candidateId,
    });

    setIsSubmitting(false);

    if (!result.ok) {
      setErrorMessage(SELECT_ERROR_MESSAGE);
      return;
    }

    setPending(null);
    router.replace(`/analyses/${result.data.analysisId}`);
  }

  function handleSkip() {
    if (!pending) {
      return;
    }
    const draftAnalysisId = pending.draftAnalysisId;
    setPending(null);
    router.replace(`/analyses/${draftAnalysisId}`);
  }

  return (
    <div className={styles.selectContainer}>
      <p className={styles.selectDescription}>
        촬영한 라벨과 가장 비슷한 제품을 골라 주세요. 선택하면 그 제품 정보로 다시 분석해요.
      </p>

      {candidates.length > 0 ? (
        <ul className={styles.candidateList}>
          {candidates.map((candidate) => (
            <li key={candidate.id}>
              <button
                type="button"
                className={styles.candidateItem}
                onClick={() => selectCandidate(candidate.id)}
                disabled={isSubmitting}
              >
                <span className={styles.candidateName}>{candidate.name}</span>
                <span className={styles.candidateMeta}>
                  {candidate.manufacturer ?? "제조사 미확인"}
                  {candidate.reportNumber ? ` · ${candidate.reportNumber}` : ""}
                </span>
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className={styles.selectEmpty}>일치하는 제품을 찾지 못했어요.</p>
      )}

      <button type="button" className={styles.skipButton} onClick={handleSkip} disabled={isSubmitting}>
        목록에 없어요
      </button>

      <form className={styles.searchForm} onSubmit={handleSearch}>
        <input
          type="text"
          className={styles.searchInput}
          placeholder="제품명으로 검색"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          disabled={isSearching}
        />
        <button type="submit" className={styles.searchButton} disabled={isSearching}>
          {isSearching ? "검색 중…" : "검색"}
        </button>
      </form>

      {errorMessage && <p className={styles.errorText}>{errorMessage}</p>}
    </div>
  );
}
