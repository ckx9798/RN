// S2 리뷰에서 발견된 문제의 회귀 테스트. 리뷰어가 제공한 프로브 스크립트
// (/private/tmp/claude-501/s2probe/probe*.ts)의 입력을 그대로 재사용한다.
//   1) label-statements.ts: 함유 절과 교차혼입 절이 한 문장에 섞인 경우
//   2) allergen-matcher.ts + ingredient-parser.ts + normalize.ts: 구분자
//      확장, 제로폭 문자, 문구 뒤에 붙은 함유/포함 접미사
//   3) 시드 match_type 조정(exact_token -> phrase)으로 잡히는 파생 표기

import { assertEquals } from "@std/assert";
import { matchAllergens } from "../_shared/domain/allergen-matcher.ts";
import { extractStatements } from "../_shared/domain/label-statements.ts";
import { ALLERGEN_TERMS } from "./fixtures/reference-data.ts";

function ids(
  ingredientsText: string | null,
  allergenStatement: string | null = null,
  crossContaminationStatement: string | null = null,
): string[] {
  return matchAllergens(
    { ingredientsText, allergenStatement, crossContaminationStatement, source: "label" },
    ALLERGEN_TERMS,
  ).map((m) => m.allergenId).sort();
}

function idsWithKind(
  ingredientsText: string | null,
  allergenStatement: string | null = null,
  crossContaminationStatement: string | null = null,
) {
  return matchAllergens(
    { ingredientsText, allergenStatement, crossContaminationStatement, source: "label" },
    ALLERGEN_TERMS,
  ).map((m) => `${m.allergenId}:${m.kind}`).sort();
}

// ---- 1) 함유 절 + 교차혼입 절이 한 문장에 섞인 경우 ----

Deno.test("item1: 함유 절과 교차혼입 절이 있으며로 이어진 문장 -> 밀/대두 direct, 땅콩 cross", () => {
  const e = extractStatements({
    ingredientsText:
      "정제수, 설탕\n이 제품은 알레르기 유발물질인 밀, 대두를 함유하고 있으며, 땅콩을 사용한 제품과 같은 제조시설에서 제조하고 있습니다.",
    allergenStatement: null,
    crossContaminationStatement: null,
    rawText: "",
  });
  const matches = idsWithKind(e.ingredientsBody, e.allergen, e.crossContamination);
  assertEquals(matches, ["FOOD-004:cross_contamination", "FOOD-005:direct", "FOOD-006:direct"]);
});

Deno.test("item1: 콤마로만 이어진 한 줄, 사용한 제품과 없는 짧은 형태 -> 밀가루/대두는 본문에 남고 땅콩만 cross", () => {
  const e = extractStatements({
    ingredientsText: "정제수, 설탕, 밀가루, 대두, 땅콩과 같은 제조시설에서 제조",
    allergenStatement: null,
    crossContaminationStatement: null,
    rawText: "",
  });
  // 밀가루·대두는 본문(ingredientsBody)에 남아 원재료 매칭(direct)으로 잡힌다.
  assertEquals(e.ingredientsBody.includes("밀가루"), true);
  assertEquals(e.ingredientsBody.includes("대두"), true);
  assertEquals(e.crossContamination !== null && e.crossContamination.includes("땅콩"), true);

  const matches = idsWithKind(e.ingredientsBody, e.allergen, e.crossContamination);
  assertEquals(matches, ["FOOD-004:cross_contamination", "FOOD-005:direct", "FOOD-006:direct"]);
});

// [2차 리뷰 수정] 이 테스트는 1차 리뷰 때 '/'를 문장 구분자로 추가해
// 통과시켰던 것인데, 2차 리뷰의 probe8(old/new 비교)가 그 설계가
// "땅콩/게를 사용한 제품과 같은 제조시설"처럼 교차혼입 지배 항목
// 목록 *안에서* '/'가 단순 나열 구분자로 쓰이는 실제 사례를 망가뜨림을
// 보여줬다(땅콩이 지배 범위 밖으로 잘려나가 direct로 오분류됨). '/'를
// 문장 구분자에서 뺀 결과, 이 테스트처럼 '/'로 원재료·함유·교차혼입
// 세 구획을 억지로 이어붙이고 그 사이에 쉼표조차 없는 흔치 않은 입력은
// 땅콩까지 direct로 판정된다(절대 안전 방향이 아닌 쪽으로 틀리지는
// 않는다 — caution severity는 동일, category만 다르다). probe8의
// 회귀가 훨씬 흔한 패턴이라 이 트레이드오프를 받아들였다(문서화:
// task-S2-report.md).
Deno.test("item1: '/'로 이어붙인 섹션 — 쉼표 없는 경계는 direct 쪽으로 남는다(probe8 회귀 수정의 트레이드오프)", () => {
  const e = extractStatements({
    ingredientsText: "밀가루, 설탕, 우유 / 대두, 밀, 우유 함유 / 이 제품은 땅콩을 사용한 제품과 같은 제조시설에서 제조",
    allergenStatement: null,
    crossContaminationStatement: null,
    rawText: "",
  });
  const matches = idsWithKind(e.ingredientsBody, e.allergen, e.crossContamination);
  const byId = new Map(matches.map((m) => m.split(":") as [string, string]));
  assertEquals(byId.get("FOOD-006"), "direct"); // 밀
  assertEquals(byId.get("FOOD-005"), "direct"); // 대두
  assertEquals(byId.get("FOOD-002"), "direct"); // 우유
  // 미탐은 아니다 — 여전히 caution으로 이어지는 direct로 잡힌다.
  assertEquals(byId.get("FOOD-004"), "direct"); // 땅콩(cross가 아니라 direct로 남음)
});

// ---- 2) 구분자 확장, 제로폭 문자, 함유/포함 접미사 ----

const SEPARATOR_INGREDIENT_CASES: Array<[string, string[]]> = [
  ["우유ㆍ대두", ["FOOD-002", "FOOD-005"]],
  ["우유;대두", ["FOOD-002", "FOOD-005"]],
  ["【우유】", ["FOOD-002"]],
  ["{대두}", ["FOOD-005"]],
  ["<밀>", ["FOOD-006"]],
  ["정제수, 우유.대두", ["FOOD-002", "FOOD-005"]],
];

for (const [text, expected] of SEPARATOR_INGREDIENT_CASES) {
  Deno.test(`item2: 원재료 구분자 확장 - ${JSON.stringify(text)}`, () => {
    assertEquals(ids(text), expected);
  });
}

const SEPARATOR_STATEMENT_CASES: Array<[string, string[]]> = [
  ["우유ㆍ대두 함유", ["FOOD-002", "FOOD-005"]],
  ["우유;대두 함유", ["FOOD-002", "FOOD-005"]],
  ["밀함유", ["FOOD-006"]],
  ["우유,대두,밀함유", ["FOOD-002", "FOOD-005", "FOOD-006"]],
  ["우유와대두함유", ["FOOD-002", "FOOD-005"]],
  ["알레르기유발물질:우유,대두", ["FOOD-002", "FOOD-005"]],
  ["【알레르기】우유", ["FOOD-002"]],
  ["혼합분말(우유:국산) 함유", ["FOOD-002"]],
];

for (const [text, expected] of SEPARATOR_STATEMENT_CASES) {
  Deno.test(`item2: 표시 문구 구분자·접미사 - ${JSON.stringify(text)}`, () => {
    assertEquals(ids(null, text), expected);
  });
}

Deno.test("item2: 제로폭 문자가 낀 '우​유'(원재료)도 매칭된다", () => {
  assertEquals(ids("우​유"), ["FOOD-002"]);
});

Deno.test("item2: 제로폭 문자가 낀 '우​유 함유'(표시 문구)도 매칭된다", () => {
  assertEquals(ids(null, "우​유 함유"), ["FOOD-002"]);
});

Deno.test("item2: 표시 문구에서도 부정 합성어(메밀가루)는 밀로 오탐하지 않는다", () => {
  assertEquals(ids(null, "메밀가루 함유"), ["FOOD-003"]);
});

// ---- 3) 시드 match_type 조정(exact_token -> phrase)으로 잡히는 파생 표기 ----

const DERIVED_FORM_CASES: Array<[string, string[]]> = [
  ["난백분", ["FOOD-001"]],
  ["난황분", ["FOOD-001"]],
  ["계란흰자", ["FOOD-001"]],
  ["전란액", ["FOOD-001"]],
  ["유청분말", ["FOOD-002"]],
  ["치즈분말", ["FOOD-002"]],
  ["새우젓", ["FOOD-010"]],
  ["소맥전분", ["FOOD-006"]],
  ["대두유", ["FOOD-005"]],
  ["쇠고기추출물", ["FOOD-018"]],
  ["토마토케첩", ["FOOD-015"]],
  ["돈육분말", ["FOOD-017"]],
];

for (const [text, expected] of DERIVED_FORM_CASES) {
  Deno.test(`item3: 표 용어의 phrase 전환으로 파생 표기 "${text}"가 잡힌다`, () => {
    assertEquals(ids(text), expected);
  });
}

Deno.test("item3: 알려진 공백 — '굴소스'는 굴이 1글자 exact_token으로 남아 잡히지 않는다(의도적, 표 밖 용어 추가 금지)", () => {
  assertEquals(ids("굴소스"), []);
});

Deno.test("item3: 알려진 공백 — '닭가슴살'은 표 9.1에 부분 문자열로 없어 잡히지 않는다(의도적, 표 밖 용어 추가 금지)", () => {
  assertEquals(ids("닭가슴살"), []);
});

Deno.test("item3: 1글자 용어(게/밀/콩/잣/굴)는 여전히 exact_token — 짧은 토큰 오탐 방지 유지", () => {
  assertEquals(ids("강낭콩"), []); // 콩
  assertEquals(ids("메밀가루"), ["FOOD-003"]); // 밀은 매칭되지 않음(메밀가루만)
  assertEquals(ids("게맛살향"), []); // 게
});

Deno.test("item3: 버터·크림·간장·된장·두부는 여전히 exact_token(부분 문자열 오탐 방지 유지)", () => {
  assertEquals(ids("식물성크림"), []); // 크림
  assertEquals(ids("무언가버터과자"), []); // 버터 (땅콩버터가 아닌 한 exact만 매칭)
});
