// S2 3차 리뷰(구조 변경, 룰링 R12)에서 발견된 label_context 미탐
// 회귀 테스트. 리뷰어가 제공한 /private/tmp/claude-501/s2probe/probe9.ts
// + cases9.json/cases10.json/cases11.json의 입력을 그대로 재사용한다.
//
// 룰링 R12: label_context 용어(알류, 조개류, 아황산류)는 조사/함유·포함
// 단서 절단, 문장 토크나이저 구분자를 거친 뒤 "어느 스캔된 텍스트에서든"
// exact_token과 동일하게 원자 토큰 정확 일치로 매칭한다 — "함유 절
// 안에서만"이라는 문맥 제약을 없앴다. kind는 교차혼입 지배 항목 목록
// 안에 있을 때만 cross_contamination이고, 그 외에는 direct다.

import { assertEquals } from "@std/assert";
import { matchAllergens } from "../_shared/domain/allergen-matcher.ts";
import { extractStatements } from "../_shared/domain/label-statements.ts";
import { ALLERGEN_TERMS } from "./fixtures/reference-data.ts";

function run(
  ingredientsText: string,
  rawText = "",
  allergenStatement: string | null = null,
  crossContaminationStatement: string | null = null,
): string[] {
  const e = extractStatements({ ingredientsText, allergenStatement, crossContaminationStatement, rawText });
  return matchAllergens(
    { ingredientsText: e.ingredientsBody, allergenStatement: e.allergen, crossContaminationStatement: e.crossContamination, source: "label" },
    ALLERGEN_TERMS,
  ).map((m) => `${m.allergenId}:${m.kind}`).sort();
}

const D = "direct";
const C = "cross_contamination";
const tag = (id: string, kind: string) => `${id}:${kind}`;

// ---- cases9: L(label_context 어디서든), D(경계), M(다중 트리거), Z(제로폭), B(괄호) ----

Deno.test("L1~L7: label_context가 함유 절과 떨어진 줄/문장에 있어도 direct로 잡힌다(R12)", () => {
  assertEquals(run("밀가루, 설탕 알류.조개류 함유"), [tag("FOOD-001", D), tag("FOOD-006", D), tag("FOOD-013", D)]);
  assertEquals(run("알류.조개류.밀 함유"), [tag("FOOD-001", D), tag("FOOD-006", D), tag("FOOD-013", D)]);
  assertEquals(run("밀가루\n알류. 조개류 함유"), [tag("FOOD-001", D), tag("FOOD-006", D), tag("FOOD-013", D)]);
  assertEquals(run("밀가루\n알류\n함유"), [tag("FOOD-001", D), tag("FOOD-006", D)]);
  assertEquals(run("밀가루, 알류, 조개류\n함유"), [tag("FOOD-001", D), tag("FOOD-006", D), tag("FOOD-013", D)]);
  assertEquals(run("밀가루\n알레르기 유발물질:\n알류, 조개류"), [tag("FOOD-001", D), tag("FOOD-006", D), tag("FOOD-013", D)]);
  assertEquals(
    run("밀가루\n[알레르기 유발물질]\n알류, 우유, 조개류(굴)"),
    [tag("FOOD-001", D), tag("FOOD-002", D), tag("FOOD-006", D), tag("FOOD-013", D)],
  );
});

Deno.test("L12/L13: rawText는 항상 direct 판정에 더해진다(룰링 7)", () => {
  assertEquals(run("설탕\n알류 함유", "밀 함유"), [tag("FOOD-001", D), tag("FOOD-006", D)]);
  assertEquals(
    run("밀가루, 우유 함유", "원재료: 밀가루\n알류, 우유 함유"),
    [tag("FOOD-001", D), tag("FOOD-002", D), tag("FOOD-006", D)],
  );
});

Deno.test("L14/L14b: allergenStatement가 필드로 주어져도, rawText만 있어도 direct 판정은 정상 동작한다", () => {
  assertEquals(run("", "", "밀가루, 설탕, 알류 함유"), [tag("FOOD-001", D), tag("FOOD-006", D)]);
  assertEquals(run("", "밀가루, 설탕"), [tag("FOOD-006", D)]);
});

Deno.test("D1/D2: '원재료(명):' 경계 뒤의 절만 교차혼입 지배 목록에 들어간다(룰링 6)", () => {
  assertEquals(
    run("원재료: 밀가루, 설탕, 땅콩을 사용한 제품과 같은 제조시설에서 제조"),
    [tag("FOOD-004", C), tag("FOOD-006", D)],
  );
  assertEquals(
    run("원재료명 밀가루, 설탕, 정제수 이 제품은 땅콩을 사용한 제품과 같은 제조시설에서 제조"),
    [tag("FOOD-004", C), tag("FOOD-006", D)],
  );
});

Deno.test("D3: 괄호 안 복합원재료는 교차혼입 지배 목록을 건너 direct로 남는다(룰링 6)", () => {
  assertEquals(
    run("혼합제제(밀, 대두), 땅콩을 사용한 제품과 같은 제조시설에서 제조"),
    [tag("FOOD-004", C), tag("FOOD-005", D), tag("FOOD-006", D)],
  );
});

Deno.test("D5/D6: 빈 입력과 crossContaminationStatement 직접 지정도 정상 동작한다", () => {
  assertEquals(run("밀가루, 설탕", "", "", ""), [tag("FOOD-006", D)]);
  // [4차, R13] "설탕"이 용어가 아니므로 지배 목록은 "땅콩"뿐 — 밀가루는 direct.
  assertEquals(
    run("", "", null, "밀가루, 설탕, 땅콩을 사용한 제품과 같은 제조시설"),
    [tag("FOOD-004", C), tag("FOOD-006", D)],
  );
});

Deno.test("M1: 한 문장에 트리거가 둘이면 둘 다 잡힌다(룰링 4)", () => {
  assertEquals(
    run("게를 사용한 제품과 같은 제조시설, 땅콩과 같은 시설에서 제조"),
    [tag("FOOD-004", C), tag("FOOD-009", C)],
  );
});

Deno.test("M2: 트리거 뒤 쉼표로 이어진 label_context도 direct로 잡힌다(R12)", () => {
  assertEquals(run("땅콩과 같은 시설에서 제조, 알류"), [tag("FOOD-001", D), tag("FOOD-004", C)]);
});

Deno.test("Z1~Z3: 제로폭·연성 하이픈·공백이 '함유'를 갈라놔도 label_context는 direct로 잡힌다(룰링 8)", () => {
  assertEquals(run("밀가루\n알류 함⁠유"), [tag("FOOD-001", D), tag("FOOD-006", D)]);
  assertEquals(run("밀가루\n알­류 함유"), [tag("FOOD-001", D), tag("FOOD-006", D)]);
  assertEquals(run("밀가루\n알류 함 유"), [tag("FOOD-001", D), tag("FOOD-006", D)]);
});

Deno.test("B1: 괄호 안 트리거는 괄호 밖 원재료를 cross로 끌고 가지 않는다", () => {
  assertEquals(
    run("밀가루(땅콩과 같은 시설), 우유"),
    [tag("FOOD-002", D), tag("FOOD-004", C), tag("FOOD-006", D)],
  );
});

Deno.test("B2~B4: 괄호로 감싼 함유 절의 label_context도 direct로 잡힌다", () => {
  assertEquals(
    run("밀가루\n(알류, 조개류 함유)"),
    [tag("FOOD-001", D), tag("FOOD-006", D), tag("FOOD-013", D)],
  );
  assertEquals(
    run("밀가루\n알레르기 유발물질(알류, 조개류)"),
    [tag("FOOD-001", D), tag("FOOD-006", D), tag("FOOD-013", D)],
  );
  assertEquals(
    run("밀가루\n알류, 조개류 (함유)"),
    [tag("FOOD-001", D), tag("FOOD-006", D), tag("FOOD-013", D)],
  );
});

// ---- cases10: N1~N11, short-form/trigger-first 쉼표 목록 전체 back-scan ----

const N_CASES: Array<[string, string[]]> = [
  ["밀가루\n이 제품은 같은 제조시설에서 땅콩, 알류를 사용한 제품을 제조하고 있습니다", [tag("FOOD-001", C), tag("FOOD-004", C), tag("FOOD-006", D)]],
  ["밀가루\n동일한 시설에서 알류, 조개류, 아황산류를 사용한 제품을 생산합니다", [tag("FOOD-001", C), tag("FOOD-006", D), tag("FOOD-013", C), tag("FOOD-019", C)]],
  ["밀가루\n알류, 조개류 혼입 가능", [tag("FOOD-001", C), tag("FOOD-006", D), tag("FOOD-013", C)]],
  ["밀가루\n알류, 조개류와 같은 시설에서 제조", [tag("FOOD-001", C), tag("FOOD-006", D), tag("FOOD-013", C)]],
  ["밀가루\n같은 시설에서 알류 제조", [tag("FOOD-001", C), tag("FOOD-006", D)]],
  ["밀가루\n알류 및 조개류와 같은 제조시설", [tag("FOOD-001", C), tag("FOOD-006", D), tag("FOOD-013", C)]],
  ["밀가루\n알류, 조개류, 아황산류와 같은 제조시설에서 제조", [tag("FOOD-001", C), tag("FOOD-006", D), tag("FOOD-013", C), tag("FOOD-019", C)]],
  ["밀가루\n혼입 가능: 알류, 조개류", [tag("FOOD-001", C), tag("FOOD-006", D), tag("FOOD-013", C)]],
  ["밀가루\n알류, 조개류와 동일한 시설에서 제조", [tag("FOOD-001", C), tag("FOOD-006", D), tag("FOOD-013", C)]],
];
for (const [text, expected] of N_CASES) {
  Deno.test(`N-case: short-form/trigger-first가 쉼표 목록 전체를 cross로 잡는다 - ${JSON.stringify(text)}`, () => {
    assertEquals(run(text), expected);
  });
}

Deno.test("N8/N9: crossContaminationStatement 필드로 직접 줘도 같은 절 분리가 적용된다", () => {
  assertEquals(
    run("", "", null, "같은 제조시설에서 알류, 조개류를 사용한 제품을 제조"),
    [tag("FOOD-001", C), tag("FOOD-013", C)],
  );
  assertEquals(run("", "", null, "알류, 조개류 혼입 가능"), [tag("FOOD-001", C), tag("FOOD-013", C)]);
});

// ---- cases11: NEGATIVE_COMPOUNDS 부분 매칭, 접속 조사, 서술어 활용형 ----

Deno.test("NC1~NC3: 부정 합성어는 겹치는 출현만 막고, 겹치지 않는 독립 출현은 막지 않는다(룰링 5)", () => {
  assertEquals(run("새우육 우육 혼합분말"), [tag("FOOD-010", D), tag("FOOD-018", D)]);
  assertEquals(run("메밀가루 밀가루 혼합분"), [tag("FOOD-003", D), tag("FOOD-006", D)]);
  assertEquals(run("혼합분말(새우육, 우육)"), [tag("FOOD-010", D), tag("FOOD-018", D)]);
});

Deno.test("G1~G3: 접속 조사(와/및/이나)로 붙은 1글자 exact_token도 각각 잡힌다", () => {
  assertEquals(run("밀가루\n알류와조개류함유"), [tag("FOOD-001", D), tag("FOOD-006", D), tag("FOOD-013", D)]);
  assertEquals(run("밀가루\n게및굴함유"), [tag("FOOD-006", D), tag("FOOD-009", D), tag("FOOD-013", D)]);
  assertEquals(run("밀가루\n잣이나호두함유"), [tag("FOOD-006", D), tag("FOOD-007", D), tag("FOOD-008", D)]);
});

Deno.test("G4/G5/S3: 소수점 낀 함유, 서술어 활용형, 콜론 원재료 라벨도 정상 매칭된다", () => {
  assertEquals(run("밀가루\n우유 0.5% 함유. 알류 함유"), [tag("FOOD-001", D), tag("FOOD-002", D), tag("FOOD-006", D)]);
  assertEquals(run("밀가루\n알류 함유됨"), [tag("FOOD-001", D), tag("FOOD-006", D)]);
  assertEquals(run("원재료: 밀가루, 알류 함유, 설탕"), [tag("FOOD-001", D), tag("FOOD-006", D)]);
});
