// 개인화 설정 화면의 폼 상태를 다루는 순수 로직이다. I/O를 하지 않으며
// 서버 컴포넌트·클라이언트 컴포넌트 어디서도 테스트하기 쉽게 유지한다.

export type DiseaseSupport =
  | "exclusive"
  | "nutrition_candidate"
  | "limited"
  | "unsupported"
  | "memo_only";

export const SUPPORT_LABEL: Record<
  DiseaseSupport,
  "분석 지원" | "일부 지원" | "정보 저장만" | "선택 상태"
> = {
  exclusive: "선택 상태",
  nutrition_candidate: "분석 지원",
  limited: "일부 지원",
  unsupported: "정보 저장만",
  memo_only: "정보 저장만",
};

export const CONSENT_VERSION = "2026-09-30";

// 설계 9.2: DIS-001(질환 없음)과 DIS-028(기타)은 배타적 선택 상태다.
export const NO_KNOWN_DISEASE_ID = "DIS-001";
export const OTHER_DISEASE_ID = "DIS-028";

const OTHER_NOTE_MAX_LENGTH = 200;

export type ProfileFormState = {
  consent: boolean;
  allergenIds: Set<string>;
  hasNoKnownDisease: boolean;
  diseaseIds: Set<string>;
  otherNote: string;
};

export function toggleAllergen(state: ProfileFormState, id: string): ProfileFormState {
  const allergenIds = new Set(state.allergenIds);
  if (allergenIds.has(id)) {
    allergenIds.delete(id);
  } else {
    allergenIds.add(id);
  }
  return { ...state, allergenIds };
}

/**
 * `DIS-001`(질환 없음)을 선택하면 다른 질환 선택을 모두 해제하고
 * `hasNoKnownDisease`를 true로 만든다. 다른 질환을 선택하면 반대로
 * `DIS-001` 선택을 해제한다. 이미 선택된 항목을 다시 누르면 해제한다.
 */
export function toggleDisease(state: ProfileFormState, id: string): ProfileFormState {
  if (id === NO_KNOWN_DISEASE_ID) {
    if (state.hasNoKnownDisease) {
      return { ...state, hasNoKnownDisease: false };
    }
    return { ...state, hasNoKnownDisease: true, diseaseIds: new Set(), otherNote: "" };
  }

  const diseaseIds = new Set(state.diseaseIds);
  let otherNote = state.otherNote;

  if (diseaseIds.has(id)) {
    diseaseIds.delete(id);
    if (id === OTHER_DISEASE_ID) {
      otherNote = "";
    }
  } else {
    diseaseIds.add(id);
  }

  return { ...state, hasNoKnownDisease: false, diseaseIds, otherNote };
}

export function setOtherNote(state: ProfileFormState, note: string): ProfileFormState {
  return { ...state, otherNote: note.slice(0, OTHER_NOTE_MAX_LENGTH) };
}

export function toSaveArgs(
  state: ProfileFormState,
  consentVersion: string,
): {
  p_consent_version: string;
  p_has_no_known_disease: boolean;
  p_allergen_ids: string[];
  p_diseases: { diseaseId: string; note: string | null }[];
} {
  const diseases = Array.from(state.diseaseIds)
    .filter((id) => id !== NO_KNOWN_DISEASE_ID)
    .map((id) => ({
      diseaseId: id,
      note: id === OTHER_DISEASE_ID ? state.otherNote.trim() || null : null,
    }));

  return {
    p_consent_version: consentVersion,
    p_has_no_known_disease: state.hasNoKnownDisease,
    p_allergen_ids: Array.from(state.allergenIds),
    p_diseases: diseases,
  };
}
