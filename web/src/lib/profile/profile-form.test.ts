import { describe, expect, it } from "vitest";
import {
  NO_KNOWN_DISEASE_ID,
  OTHER_DISEASE_ID,
  toSaveArgs,
  toggleAllergen,
  toggleDisease,
  type ProfileFormState,
} from "./profile-form";

function emptyState(): ProfileFormState {
  return {
    consent: false,
    allergenIds: new Set(),
    hasNoKnownDisease: false,
    diseaseIds: new Set(),
    otherNote: "",
  };
}

describe("toggleDisease", () => {
  it("DIS-001(질환 없음)을 선택하면 선택된 다른 질환을 모두 해제한다", () => {
    const state: ProfileFormState = {
      ...emptyState(),
      diseaseIds: new Set(["DIS-002", "DIS-003"]),
    };

    const next = toggleDisease(state, NO_KNOWN_DISEASE_ID);

    expect(next.hasNoKnownDisease).toBe(true);
    expect(next.diseaseIds.size).toBe(0);
  });

  it("다른 질환을 선택하면 DIS-001 선택을 해제한다", () => {
    const state: ProfileFormState = { ...emptyState(), hasNoKnownDisease: true };

    const next = toggleDisease(state, "DIS-002");

    expect(next.hasNoKnownDisease).toBe(false);
    expect(next.diseaseIds.has("DIS-002")).toBe(true);
  });

  it("이미 선택된 질환을 다시 누르면 해제한다", () => {
    const state: ProfileFormState = { ...emptyState(), diseaseIds: new Set(["DIS-002"]) };

    const next = toggleDisease(state, "DIS-002");

    expect(next.diseaseIds.has("DIS-002")).toBe(false);
  });

  it("DIS-028(기타) 선택을 해제하면 메모도 비운다", () => {
    const state: ProfileFormState = {
      ...emptyState(),
      diseaseIds: new Set([OTHER_DISEASE_ID]),
      otherNote: "기타 질환 메모",
    };

    const next = toggleDisease(state, OTHER_DISEASE_ID);

    expect(next.diseaseIds.has(OTHER_DISEASE_ID)).toBe(false);
    expect(next.otherNote).toBe("");
  });

  it("이미 선택된 DIS-001을 다시 누르면 해제한다", () => {
    const state: ProfileFormState = { ...emptyState(), hasNoKnownDisease: true };

    const next = toggleDisease(state, NO_KNOWN_DISEASE_ID);

    expect(next.hasNoKnownDisease).toBe(false);
  });
});

describe("toggleAllergen", () => {
  it("선택하지 않은 알레르기를 누르면 추가한다", () => {
    const next = toggleAllergen(emptyState(), "FOOD-001");
    expect(next.allergenIds.has("FOOD-001")).toBe(true);
  });

  it("선택한 알레르기를 다시 누르면 제거한다", () => {
    const state: ProfileFormState = { ...emptyState(), allergenIds: new Set(["FOOD-001"]) };
    const next = toggleAllergen(state, "FOOD-001");
    expect(next.allergenIds.has("FOOD-001")).toBe(false);
  });
});

describe("toSaveArgs", () => {
  it("DIS-001은 p_diseases에 포함하지 않는다", () => {
    const state: ProfileFormState = { ...emptyState(), hasNoKnownDisease: true };

    const args = toSaveArgs(state, "2026-09-30");

    expect(args.p_has_no_known_disease).toBe(true);
    expect(args.p_diseases).toEqual([]);
  });

  it("DIS-028에만 note를 채우고 나머지는 null이다", () => {
    const state: ProfileFormState = {
      ...emptyState(),
      diseaseIds: new Set(["DIS-002", OTHER_DISEASE_ID]),
      otherNote: "기타 질환 메모",
    };

    const args = toSaveArgs(state, "2026-09-30");

    expect(args.p_diseases).toEqual(
      expect.arrayContaining([
        { diseaseId: "DIS-002", note: null },
        { diseaseId: OTHER_DISEASE_ID, note: "기타 질환 메모" },
      ]),
    );
  });

  it("DIS-028 메모가 공백뿐이면 null로 저장한다", () => {
    const state: ProfileFormState = {
      ...emptyState(),
      diseaseIds: new Set([OTHER_DISEASE_ID]),
      otherNote: "   ",
    };

    const args = toSaveArgs(state, "2026-09-30");

    expect(args.p_diseases).toEqual([{ diseaseId: OTHER_DISEASE_ID, note: null }]);
  });

  it("consentVersion과 allergenIds를 그대로 전달한다", () => {
    const state: ProfileFormState = {
      ...emptyState(),
      allergenIds: new Set(["FOOD-001", "FOOD-006"]),
    };

    const args = toSaveArgs(state, "2026-09-30");

    expect(args.p_consent_version).toBe("2026-09-30");
    expect(args.p_allergen_ids.sort()).toEqual(["FOOD-001", "FOOD-006"]);
  });
});
