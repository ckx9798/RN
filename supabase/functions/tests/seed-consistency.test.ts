// 시드 SQL(supabase/migrations/20260930000300_reference_seed.sql)과 테스트
// 픽스처(fixtures/reference-data.ts)가 갈라지지 않았음을 보증한다.
// cwd에 의존하지 않도록 import.meta.url 기준 상대 경로로 파일을 읽는다.

import { assertEquals } from "@std/assert";
import { dirname, fromFileUrl, join } from "@std/path";
import { ALLERGEN_STANDARDS, ALLERGEN_TERMS, DISEASE_STANDARDS } from "./fixtures/reference-data.ts";

const SEED_PATH = join(
  dirname(fromFileUrl(import.meta.url)),
  "..",
  "..",
  "migrations",
  "20260930000300_reference_seed.sql",
);

type SeedAllergenStandard = {
  id: string;
  name: string;
  sourceUrl: string;
};

type SeedAllergenTerm = {
  allergenId: string;
  term: string;
  matchType: string;
  confidence: string;
  priority: number;
};

type SeedDisease = {
  id: string;
  name: string;
  analysisSupport: string;
  relatedNutrients: string[];
};

function parseAllergenStandards(sql: string): SeedAllergenStandard[] {
  const re = /\('(FOOD-\d{3})',\s*'([^']*)',\s*'([^']*)',\s*'[^']*'\)/g;
  const results: SeedAllergenStandard[] = [];
  for (const m of sql.matchAll(re)) {
    results.push({ id: m[1], name: m[2], sourceUrl: m[3] });
  }
  return results;
}

function parseAllergenTerms(sql: string): SeedAllergenTerm[] {
  const re = /\('(FOOD-\d{3})',\s*'([^']*)',\s*'(\w+)',\s*'(\w+)',\s*(\d+)\)/g;
  const results: SeedAllergenTerm[] = [];
  for (const m of sql.matchAll(re)) {
    results.push({
      allergenId: m[1],
      term: m[2],
      matchType: m[3],
      confidence: m[4],
      priority: Number(m[5]),
    });
  }
  return results;
}

function parseDiseaseStandards(sql: string): SeedDisease[] {
  const re =
    /\('(DIS-\d{3})',\s*'[^']*',\s*'([^']*)',\s*(?:null|'[^']*'),\s*'[^']*',\s*'(\w+)',\s*'\{([^}]*)\}'\)/g;
  const results: SeedDisease[] = [];
  for (const m of sql.matchAll(re)) {
    results.push({
      id: m[1],
      name: m[2],
      analysisSupport: m[3],
      relatedNutrients: m[4] === "" ? [] : m[4].split(","),
    });
  }
  return results;
}

function sortKey(v: unknown): string {
  return JSON.stringify(v);
}

Deno.test("시드 일치: allergen_standards가 fixture와 집합이 같다(M9)", async () => {
  const sql = await Deno.readTextFile(SEED_PATH);
  const seedStandards = parseAllergenStandards(sql);

  assertEquals(seedStandards.length, 19, "시드에서 allergen_standards 19행을 못 읽었다(정규식 확인 필요)");

  const seedSet = seedStandards.map(sortKey).sort();
  const fixtureSet = ALLERGEN_STANDARDS.map(sortKey).sort();
  assertEquals(fixtureSet, seedSet);
});

Deno.test("시드 일치: allergen_match_terms가 fixture와 집합이 같다", async () => {
  const sql = await Deno.readTextFile(SEED_PATH);
  const seedTerms = parseAllergenTerms(sql);

  assertEquals(seedTerms.length > 0, true, "시드에서 match term을 하나도 못 읽었다(정규식 확인 필요)");

  const seedSet = seedTerms.map(sortKey).sort();
  const fixtureSet = ALLERGEN_TERMS.map(sortKey).sort();
  assertEquals(fixtureSet, seedSet);
});

Deno.test("시드 일치: disease_standards가 fixture와 집합이 같다", async () => {
  const sql = await Deno.readTextFile(SEED_PATH);
  const seedDiseases = parseDiseaseStandards(sql);

  assertEquals(seedDiseases.length, 28, "시드에서 질환 28행을 못 읽었다(정규식 확인 필요)");

  const seedSet = seedDiseases
    .map((d) => sortKey({ ...d, relatedNutrients: [...d.relatedNutrients].sort() }))
    .sort();
  const fixtureSet = DISEASE_STANDARDS.map((d) =>
    sortKey({ ...d, relatedNutrients: [...d.relatedNutrients].sort() })
  ).sort();
  assertEquals(fixtureSet, seedSet);
});
