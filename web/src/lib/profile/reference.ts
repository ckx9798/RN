import type { SupabaseClient } from "@supabase/supabase-js";
import type { DiseaseSupport } from "./profile-form";

// 생성된 Supabase 타입이 없으므로(S1 진행 중) 쿼리에 필요한 만큼만
// 로컬 행 타입을 정의한다.

export type AllergenStandard = {
  id: string;
  name: string;
};

export type DiseaseStandard = {
  id: string;
  category: string;
  name: string;
  analysisSupport: DiseaseSupport;
};

export type DiseaseCategoryGroup = {
  category: string;
  diseases: DiseaseStandard[];
};

export type UserProfileSelection = {
  hasConsented: boolean;
  hasNoKnownDisease: boolean;
  allergenIds: string[];
  diseases: { diseaseId: string; note: string | null }[];
};

type AllergenStandardRow = { id: string; name: string };
type DiseaseStandardRow = {
  id: string;
  category: string;
  name: string;
  analysis_support: DiseaseSupport;
};
type ProfileRow = { consent_version: string | null; has_no_known_disease: boolean | null };
type UserAllergenRow = { allergen_id: string };
type UserDiseaseRow = { disease_id: string; note: string | null };

export async function fetchAllergenStandards(
  supabase: SupabaseClient,
): Promise<AllergenStandard[]> {
  const { data, error } = await supabase
    .from("allergen_standards")
    .select("id, name")
    .eq("active", true)
    .order("id", { ascending: true });

  if (error || !data) {
    return [];
  }

  return (data as AllergenStandardRow[]).map((row) => ({ id: row.id, name: row.name }));
}

export async function fetchDiseaseCategoryGroups(
  supabase: SupabaseClient,
): Promise<DiseaseCategoryGroup[]> {
  const { data, error } = await supabase
    .from("disease_standards")
    .select("id, category, name, analysis_support")
    .eq("active", true)
    .order("id", { ascending: true });

  if (error || !data) {
    return [];
  }

  const groupsByCategory = new Map<string, DiseaseStandard[]>();
  for (const row of data as DiseaseStandardRow[]) {
    const diseases = groupsByCategory.get(row.category) ?? [];
    diseases.push({
      id: row.id,
      category: row.category,
      name: row.name,
      analysisSupport: row.analysis_support,
    });
    groupsByCategory.set(row.category, diseases);
  }

  return Array.from(groupsByCategory.entries()).map(([category, diseases]) => ({
    category,
    diseases,
  }));
}

export async function fetchMyProfileSelection(
  supabase: SupabaseClient,
  userId: string,
): Promise<UserProfileSelection> {
  const [profileResult, allergenResult, diseaseResult] = await Promise.all([
    supabase
      .from("profiles")
      .select("consent_version, has_no_known_disease")
      .eq("user_id", userId)
      .maybeSingle(),
    supabase.from("user_allergens").select("allergen_id").eq("user_id", userId),
    supabase.from("user_diseases").select("disease_id, note").eq("user_id", userId),
  ]);

  const profile = profileResult.data as ProfileRow | null;
  const allergens = (allergenResult.data as UserAllergenRow[] | null) ?? [];
  const diseases = (diseaseResult.data as UserDiseaseRow[] | null) ?? [];

  return {
    hasConsented: Boolean(profile?.consent_version),
    hasNoKnownDisease: Boolean(profile?.has_no_known_disease),
    allergenIds: allergens.map((row) => row.allergen_id),
    diseases: diseases.map((row) => ({ diseaseId: row.disease_id, note: row.note })),
  };
}
