import { redirect } from "next/navigation";
import { createServerSupabase } from "@/lib/supabase/server";
import {
  fetchAllergenStandards,
  fetchDiseaseCategoryGroups,
  fetchMyProfileSelection,
} from "@/lib/profile/reference";
import { OTHER_DISEASE_ID, type ProfileFormState } from "@/lib/profile/profile-form";
import { PageHeader } from "@/components/page-header";
import { ProfileFormView } from "./profile-form-view";
import styles from "./profile.module.css";

export default async function ProfilePage() {
  const supabase = await createServerSupabase();
  const { data: userData, error: userError } = await supabase.auth.getUser();

  if (userError || !userData.user) {
    redirect("/login");
  }

  const [allergens, diseaseCategoryGroups, selection] = await Promise.all([
    fetchAllergenStandards(supabase),
    fetchDiseaseCategoryGroups(supabase),
    fetchMyProfileSelection(supabase, userData.user.id),
  ]);

  const otherNote =
    selection.diseases.find((disease) => disease.diseaseId === OTHER_DISEASE_ID)?.note ?? "";

  const initialState: ProfileFormState = {
    consent: selection.hasConsented,
    allergenIds: new Set(selection.allergenIds),
    hasNoKnownDisease: selection.hasNoKnownDisease,
    diseaseIds: new Set(selection.diseases.map((disease) => disease.diseaseId)),
    otherNote,
  };

  return (
    <div className={styles.page}>
      <PageHeader title="개인화 설정" backHref="/" />
      <ProfileFormView
        allergens={allergens}
        diseaseCategoryGroups={diseaseCategoryGroups}
        initialState={initialState}
      />
    </div>
  );
}
