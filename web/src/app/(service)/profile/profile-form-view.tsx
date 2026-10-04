"use client";

import { useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { createBrowserSupabase } from "@/lib/supabase/client";
import {
  CONSENT_VERSION,
  NO_KNOWN_DISEASE_ID,
  OTHER_DISEASE_ID,
  setOtherNote,
  toSaveArgs,
  toggleAllergen,
  toggleDisease,
  type ProfileFormState,
} from "@/lib/profile/profile-form";
import type { AllergenStandard, DiseaseCategoryGroup } from "@/lib/profile/reference";
import { SupportBadge } from "@/components/support-badge";
import { ConsentNotice } from "@/components/consent-notice";
import styles from "./profile.module.css";

const OTHER_NOTE_MAX_LENGTH = 200;
const SAVE_ERROR_MESSAGE = "저장하지 못했어요. 잠시 후 다시 시도해 주세요.";

export function ProfileFormView({
  allergens,
  diseaseCategoryGroups,
  initialState,
}: {
  allergens: AllergenStandard[];
  diseaseCategoryGroups: DiseaseCategoryGroup[];
  initialState: ProfileFormState;
}) {
  const router = useRouter();
  const supabase = useRef(createBrowserSupabase()).current;

  const [state, setState] = useState<ProfileFormState>(initialState);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!state.consent || isSaving) {
      return;
    }

    setIsSaving(true);
    setError(null);

    const { error: saveError } = await supabase.rpc(
      "save_my_profile",
      toSaveArgs(state, CONSENT_VERSION),
    );

    setIsSaving(false);

    if (saveError) {
      setError(SAVE_ERROR_MESSAGE);
      return;
    }

    router.replace("/");
  }

  return (
    <form className={styles.form} onSubmit={handleSubmit}>
      <ConsentNotice
        checked={state.consent}
        onChange={(checked) => setState((current) => ({ ...current, consent: checked }))}
      />

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>알레르기</h2>
        <div className={styles.checklist}>
          {allergens.map((allergen) => (
            <label key={allergen.id} className={styles.checkItem}>
              <input
                type="checkbox"
                checked={state.allergenIds.has(allergen.id)}
                onChange={() => setState((current) => toggleAllergen(current, allergen.id))}
              />
              <span>{allergen.name}</span>
            </label>
          ))}
        </div>
      </section>

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>질환</h2>
        {diseaseCategoryGroups.map((group) => (
          <div key={group.category} className={styles.categoryGroup}>
            <h3 className={styles.categoryTitle}>{group.category}</h3>
            <div className={styles.checklist}>
              {group.diseases.map((disease) => {
                const checked =
                  disease.id === NO_KNOWN_DISEASE_ID
                    ? state.hasNoKnownDisease
                    : state.diseaseIds.has(disease.id);

                return (
                  <div key={disease.id} className={styles.diseaseRow}>
                    <label className={styles.checkItem}>
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => setState((current) => toggleDisease(current, disease.id))}
                      />
                      <span>{disease.name}</span>
                      <SupportBadge support={disease.analysisSupport} />
                    </label>
                    {disease.id === OTHER_DISEASE_ID && state.diseaseIds.has(OTHER_DISEASE_ID) && (
                      <textarea
                        className={styles.noteInput}
                        value={state.otherNote}
                        maxLength={OTHER_NOTE_MAX_LENGTH}
                        placeholder="어떤 질환인지 간단히 남겨 주세요."
                        onChange={(event) =>
                          setState((current) => setOtherNote(current, event.target.value))
                        }
                      />
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </section>

      {error && <p className={styles.errorText}>{error}</p>}

      <button type="submit" className={styles.submitButton} disabled={!state.consent || isSaving}>
        저장
      </button>
    </form>
  );
}
