import type { SupabaseClient } from "@supabase/supabase-js";
import type { AnalysisDeps } from "./run-analysis.ts";
import type {
  AllergenTerm,
  DiseaseRule,
  DiseaseStandard,
  NutrientKey,
} from "../domain/types.ts";

type StandardRow = { id: string; name: string; source_url: string };
type TermRow = {
  allergen_id: string;
  term: string;
  match_type: AllergenTerm["matchType"];
  confidence: AllergenTerm["confidence"];
  priority: number;
};
type DiseaseRow = {
  id: string;
  name: string;
  analysis_support: DiseaseStandard["analysisSupport"];
  related_nutrients: NutrientKey[];
};
type RuleRow = {
  id: number;
  disease_id: string;
  target_key: NutrientKey;
  operator: DiseaseRule["operator"];
  threshold: number | string | null;
  unit: DiseaseRule["unit"];
  severity: DiseaseRule["severity"];
  message: string;
  evidence_url: string | null;
  rule_version: string;
  reviewed_at: string | null;
  active: boolean;
};
type ProfileRow = { consent_version: string; has_no_known_disease: boolean };
function fail(): never {
  throw new Error("analysis_store_failed");
}

/** Only pass the authenticated caller's client, never a service-role client. */
export function createAnalysisStore(
  client: SupabaseClient,
): Pick<AnalysisDeps, "loadReference" | "loadProfile" | "save"> {
  return {
    async loadReference() {
      const [standards, terms, diseases, rules] = await Promise.all([
        client.from("allergen_standards").select("id,name,source_url").eq(
          "active",
          true,
        ).order("id").returns<StandardRow[]>(),
        client.from("allergen_match_terms").select(
          "allergen_id,term,match_type,confidence,priority",
        ).eq("active", true).order("priority").returns<TermRow[]>(),
        client.from("disease_standards").select(
          "id,name,analysis_support,related_nutrients",
        ).eq("active", true).order("id").returns<DiseaseRow[]>(),
        client.from("disease_rules").select(
          "id,disease_id,target_key,operator,threshold,unit,severity,message,evidence_url,rule_version,reviewed_at,active",
        ).eq("active", true).returns<RuleRow[]>(),
      ]);
      if (
        standards.error || terms.error || diseases.error || rules.error ||
        !standards.data || !terms.data || !diseases.data || !rules.data
      ) fail();
      return {
        allergenStandards: standards.data.map((r) => ({
          id: r.id,
          name: r.name,
          sourceUrl: r.source_url,
        })),
        terms: terms.data.map((r) => ({
          allergenId: r.allergen_id,
          term: r.term,
          matchType: r.match_type,
          confidence: r.confidence,
          priority: r.priority,
        })),
        diseases: diseases.data.map((r) => ({
          id: r.id,
          name: r.name,
          analysisSupport: r.analysis_support,
          relatedNutrients: r.related_nutrients,
        })),
        rules: rules.data.map((r) => ({
          id: r.id,
          diseaseId: r.disease_id,
          targetKey: r.target_key,
          operator: r.operator,
          threshold: r.threshold === null ? null : Number(r.threshold),
          unit: r.unit,
          severity: r.severity,
          message: r.message,
          evidenceUrl: r.evidence_url,
          ruleVersion: r.rule_version,
          reviewedAt: r.reviewed_at,
          active: r.active,
        })),
      };
    },
    async loadProfile() {
      const response = await client.from("profiles").select(
        "consent_version,has_no_known_disease",
      ).maybeSingle<ProfileRow>();
      if (response.error) fail();
      if (!response.data) return null;
      const [allergens, diseases] = await Promise.all([
        client.from("user_allergens").select("allergen_id").returns<
          { allergen_id: string }[]
        >(),
        client.from("user_diseases").select("disease_id").returns<
          { disease_id: string }[]
        >(),
      ]);
      if (
        allergens.error || diseases.error || !allergens.data || !diseases.data
      ) fail();
      return {
        consentVersion: response.data.consent_version,
        hasNoKnownDisease: response.data.has_no_known_disease,
        allergenIds: allergens.data.map((r) => r.allergen_id),
        diseaseIds: diseases.data.map((r) => r.disease_id),
      };
    },
    async save({ result, scan, profile, productId }) {
      // One Postgres transaction, still using the caller's RLS permissions.
      const { data, error } = await client.rpc("save_my_analysis", {
        p_record: { result, scan, profile, productId },
      }).returns<string>();
      if (error || typeof data !== "string" || !data) fail();
      return data;
    },
  };
}
