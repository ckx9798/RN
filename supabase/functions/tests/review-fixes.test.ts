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

// [3차 리뷰 수정, 룰링 2] short-form의 쉼표 목록 역행 탐색을 full-form과
// "정확히 같게" 일반화한 결과(N1~N11), 트리거 바로 앞에 경계 표식이
// 전혀 없으면 문장 맨 앞까지 전부 지배 목록으로 본다 — full-form이
// "원재료:" 같은 표식 없이 쓰이면 앞의 원재료까지 쓸어가는 것과 동일한
// 동작이다. 그 결과 이 문장은 밀가루·대두까지 땅콩과 함께 교차혼입으로
// 잡힌다(여전히 caution, 미탐 아님). 이전 기대값(밀가루/대두 direct)은
// 룰링 2가 명시적으로 요구하는 N4류 동작("알류, 조개류와 같은 시설" →
// 둘 다 cross)과 구조적으로 같은 코드 경로라 되돌릴 수 없다.
Deno.test("item1/R3: 경계 표식이 없는 콤마 목록은 short-form도 전부 지배 항목으로 본다(룰링 2, 이전 기대값 대체)", () => {
  const e = extractStatements({
    ingredientsText: "정제수, 설탕, 밀가루, 대두, 땅콩과 같은 제조시설에서 제조",
    allergenStatement: null,
    crossContaminationStatement: null,
    rawText: "",
  });
  assertEquals(e.crossContamination !== null && e.crossContamination.includes("땅콩"), true);

  const matches = idsWithKind(e.ingredientsBody, e.allergen, e.crossContamination);
  assertEquals(matches, [
    "FOOD-004:cross_contamination",
    "FOOD-005:cross_contamination",
    "FOOD-006:cross_contamination",
  ]);
});

// [2차 리뷰에서 발견한 '/' 트레이드오프가 3차 리뷰 수정으로 완전히
// 해소됨] 2차 리뷰 때는 '/'를 문장 구분자에서 뺀 부작용으로 이 사례의
// "땅콩"이 cross가 아니라 direct로 남는 트레이드오프를 받아들였다.
// 3차 리뷰에서 findListStart가 '/'도 항목 경계로 보고(룰링 1의 F2
// 대응), "이 제품은"을 절 경계로 인식하게(룰링 6) 되면서, '/'로 이어
// 붙인 앞 구획("밀가루, 설탕, 우유 / 대두, 밀, 우유 함유")이 전부
// "이 제품은" 앞에서 잘려나가 정확히 direct로, "땅콩"만 cross로
// 분리된다 — 더는 트레이드오프가 아니라 완전히 맞는 결과다.
Deno.test("item1: '/'로 이어붙인 섹션도 이제 정확히 분리된다(3차 리뷰로 트레이드오프 해소)", () => {
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
  assertEquals(byId.get("FOOD-004"), "cross_contamination"); // 땅콩
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
