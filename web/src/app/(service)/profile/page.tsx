import { redirect } from "next/navigation";
import Link from "next/link";
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
  const { data, error } = await supabase.auth.getClaims();

  if (error || !data) {
    redirect("/login");
  }

  const userId = data.claims.sub;

  const loaded = await Promise.all([
    fetchAllergenStandards(supabase),
    fetchDiseaseCategoryGroups(supabase),
    fetchMyProfileSelection(supabase, userId),
  ]).catch(() => null);

  if (!loaded) {
    return (
      <div className={styles.page}>
        <PageHeader title="개인화 설정" backHref="/" />
        <p role="alert">기존 설정을 불러오지 못했어요. 저장된 정보는 변경하지 않았어요.</p>
        <Link href="/profile">다시 불러오기</Link>
      </div>
    );
  }
  const [allergens, diseaseCategoryGroups, selection] = loaded;

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
