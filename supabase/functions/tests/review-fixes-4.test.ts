// S2 4차 리뷰(룰링 R13) 회귀 테스트.
//
// R13: 교차혼입 트리거가 지배하는 항목은 트리거에 맞닿은 "정확히 용어인
// 토큰"(조사 제거 후, 용어에 붙은 괄호 묶음 포함)의 최대 연속 목록이다.
// 목록 구분자는 , ， ㆍ / 및 와 과 등 과 공백뿐이고, 용어가 아닌 첫
// 토큰에서 목록이 끝난다. 목록 밖은 전부 direct다.

import { assertEquals } from "@std/assert";
import { matchAllergens } from "../_shared/domain/allergen-matcher.ts";
import { splitCrossSpans } from "../_shared/domain/cross-spans.ts";
import { extractStatements } from "../_shared/domain/label-statements.ts";
import { normalizeText } from "../_shared/domain/normalize.ts";
import { CROSS_SPAN_SWEEP_CASES } from "./fixtures/cross-span-sweep.ts";
import { ALLERGEN_TERMS } from "./fixtures/reference-data.ts";

type Kinds = { direct: string[]; cross: string[] };

function run(
  ingredientsText: string,
  rawText = "",
  allergenStatement: string | null = null,
  crossContaminationStatement: string | null = null,
): Kinds {
  const e = extractStatements({ ingredientsText, allergenStatement, crossContaminationStatement, rawText });
  const matches = matchAllergens(
    {
      ingredientsText: e.ingredientsBody,
      allergenStatement: e.allergen,
      crossContaminationStatement: e.crossContamination,
      source: "label",
    },
    ALLERGEN_TERMS,
  );
  const pick = (kind: string) =>
    [...new Set(matches.filter((m) => m.kind === kind).map((m) => m.allergenId))].sort();
  return { direct: pick("direct"), cross: pick("cross_contamination") };
}

const expect = (direct: string[], cross: string[]): Kinds => ({ direct: [...direct].sort(), cross: [...cross].sort() });

const TERM_STRINGS = ALLERGEN_TERMS.map((t) => normalizeText(t.term));

// ---- splitCrossSpans 단위 ----

Deno.test("R13 단위: 용어가 아닌 토큰에서 목록이 끝나고 목록 밖은 direct 텍스트로 남는다", () => {
  const split = splitCrossSpans("밀가루, 설탕, 대두, 땅콩과 같은 시설", TERM_STRINGS);
  assertEquals(split.hasTrigger, true);
  assertEquals(split.crossItems.sort(), ["대두", "땅콩"]);
  assertEquals(split.directText.includes("밀가루"), true);
  assertEquals(split.directText.includes("땅콩"), false);
});

Deno.test("R13 단위: 용어에 붙은 괄호 묶음은 항목의 일부, 괄호 안이 용어가 아니면 항목이 아니다", () => {
  assertEquals(splitCrossSpans("땅콩, 조개류(굴, 홍합)를 사용한 제품과 같은 제조시설", TERM_STRINGS).crossItems.sort(), [
    "땅콩",
    "조개류(굴, 홍합)",
  ]);
  assertEquals(splitCrossSpans("밀가루(밀 100%), 땅콩 및 호두와 같은 시설", TERM_STRINGS).crossItems.sort(), [
    "땅콩",
    "호두",
  ]);
});

Deno.test("R13 단위: 트리거가 없으면 지배 항목도 없다", () => {
  const split = splitCrossSpans("밀가루, 우유 함유", TERM_STRINGS);
  assertEquals(split.hasTrigger, false);
  assertEquals(split.crossItems, []);
});

// ---- A. 경계 표식 없는 short-form 앞의 direct가 cross로 격하되지 않는다 ----

Deno.test("A: 용어가 아닌 토큰(설탕 등) 앞은 direct", () => {
  assertEquals(run("밀가루, 설탕, 땅콩과 같은 제조시설에서 제조"), expect(["FOOD-006"], ["FOOD-004"]));
  assertEquals(run("소맥분(미국산), 정제염, 대두유, 새우와 같은 시설"), expect(["FOOD-005", "FOOD-006"], ["FOOD-010"]));
  assertEquals(run("밀가루, 설탕, 대두, 땅콩과 같은 시설"), expect(["FOOD-006"], ["FOOD-004", "FOOD-005"]));
  assertEquals(run("밀가루 - 설탕 - 땅콩과 같은 시설"), expect(["FOOD-006"], ["FOOD-004"]));
  assertEquals(run("밀가루, 설탕, 혼입 가능성: 땅콩"), expect(["FOOD-006"], ["FOOD-004"]));
});

Deno.test("A: 붙여 쓴 '원재료명:밀가루'는 용어 토큰이 아니고, 맞닿은 우유는 cross(R13)", () => {
  assertEquals(run("원재료명:밀가루,우유,땅콩과같은시설에서제조"), expect(["FOOD-006"], ["FOOD-002", "FOOD-004"]));
});

Deno.test("A: '|'는 경계 — 앞의 우유는 direct", () => {
  assertEquals(run("원재료 | 밀가루, 우유 | 땅콩과 같은 시설"), expect(["FOOD-002", "FOOD-006"], ["FOOD-004"]));
});

// ---- B. trigger-first 목록이 문장 끝까지 번지지 않는다 ----

Deno.test("B: 트리거 뒤 첫 토큰이 용어가 아니면 지배 목록이 없다", () => {
  assertEquals(
    run("이 제품은 같은 제조시설에서 제조합니다 원재료: 밀가루, 우유, 대두"),
    expect(["FOOD-002", "FOOD-005", "FOOD-006"], []),
  );
});

Deno.test("B: trigger-first 목록은 용어가 아닌 토큰에서 끝난다", () => {
  assertEquals(
    run("같은 시설에서 땅콩, 호두를 가공합니다 원재료명: 밀가루, 우유"),
    expect(["FOOD-002", "FOOD-006"], ["FOOD-004", "FOOD-008"]),
  );
  assertEquals(run("혼입 가능: 땅콩 원재료: 밀가루, 우유"), expect(["FOOD-002", "FOOD-006"], ["FOOD-004"]));
});

// ---- C. 괄호 안 트리거 ----

Deno.test("C: 괄호 안 트리거는 괄호 안 맞닿은 용어만 지배한다(전지분유는 용어라 R13상 cross)", () => {
  assertEquals(
    run("초콜릿칩(설탕, 전지분유, 땅콩과 같은 시설에서 제조), 밀가루"),
    expect(["FOOD-006"], ["FOOD-002", "FOOD-004"]),
  );
  assertEquals(
    run("초콜릿칩(설탕, 코코아, 땅콩과 같은 시설에서 제조), 밀가루, 우유"),
    expect(["FOOD-002", "FOOD-006"], ["FOOD-004"]),
  );
});

// ---- D. rawText도 같은 범위 규칙 ----

Deno.test("D: 모든 필드 + 이를 중복한 rawText에서도 cross는 cross로 남는다", () => {
  const cross = "이 제품은 땅콩, 새우를 사용한 제품과 같은 제조시설에서 제조";
  assertEquals(
    run("밀가루, 설탕, 버터", `원재료명: 밀가루, 설탕, 버터\n알류, 우유, 밀 함유\n${cross}`, "알류, 우유, 밀 함유", cross),
    expect(["FOOD-001", "FOOD-002", "FOOD-006"], ["FOOD-004", "FOOD-010"]),
  );
  assertEquals(
    run("", `원재료명: 밀가루, 설탕, 버터\n알류, 우유, 밀 함유\n${cross}`),
    expect(["FOOD-001", "FOOD-002", "FOOD-006"], ["FOOD-004", "FOOD-010"]),
  );
});

// ---- E. 괄호 묶음이 붙은 항목 ----

Deno.test("E: '조개류(굴)와', '조개류(굴, 홍합)를'도 지배 목록의 항목이다", () => {
  assertEquals(run("정제수\n땅콩, 조개류(굴)와 같은 시설에서 제조"), expect([], ["FOOD-004", "FOOD-013"]));
  assertEquals(
    run("정제수\n땅콩, 조개류(굴, 홍합)를 사용한 제품과 같은 제조시설에서 제조"),
    expect([], ["FOOD-004", "FOOD-013"]),
  );
});

// ---- F. 공백을 포함한 용어(sulfur dioxide) ----

Deno.test("F: sulfur dioxide는 어느 범위에서든 잡힌다(조사가 붙어도)", () => {
  assertEquals(run("건조살구, sulfur dioxide, 땅콩과 같은 시설"), expect([], ["FOOD-004", "FOOD-019"]));
  assertEquals(run("건조살구(sulfur dioxide, 땅콩과 같은 시설)"), expect([], ["FOOD-004", "FOOD-019"]));
  assertEquals(run("같은 시설에서 제조합니다 원재료: 건조살구, sulfur dioxide"), expect(["FOOD-019"], []));
  assertEquals(run("건조살구\nSulfur Dioxide와 같은 시설에서 제조"), expect([], ["FOOD-019"]));
  assertEquals(
    run("건조살구, Sulfur Dioxide, 땅콩을 사용한 제품과 같은 제조시설에서 제조"),
    expect([], ["FOOD-004", "FOOD-019"]),
  );
  assertEquals(run("건조살구, 설탕, Sulfur Dioxide"), expect(["FOOD-019"], []));
});

// ---- G. OCR 분리·붙여 쓰기 ----

Deno.test("G: 한 칸 띄워 읽힌 label_context 용어도 잡힌다", () => {
  assertEquals(run("밀가루 , 알 류 , 우유 함유"), expect(["FOOD-001", "FOOD-002", "FOOD-006"], []));
  assertEquals(run("밀가루\n조개 류 함유"), expect(["FOOD-006", "FOOD-013"], []));
  assertEquals(run("건포도\n아황산 류 함유"), expect(["FOOD-019"], []));
});

Deno.test("G: 공백 없이 붙은 trigger-first 문장도 목록을 찾는다", () => {
  assertEquals(
    run("밀가루\n같은제조시설에서알류,조개류를사용한제품을제조"),
    expect(["FOOD-006"], ["FOOD-001", "FOOD-013"]),
  );
});

// ---- 리뷰어 스윕 77건 ----

for (const c of CROSS_SPAN_SWEEP_CASES) {
  Deno.test(`sweep ${c.n}${c.why ? ` (R13 조정: ${c.why})` : ""}`, () => {
    assertEquals(run(c.i, c.raw, c.a, c.c), expect(c.d, c.x));
  });
}
