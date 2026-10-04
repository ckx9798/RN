// S2 2차 리뷰(구조 변경)에서 발견된 문제의 회귀 테스트. 리뷰어가 제공한
// 프로브 스크립트(/private/tmp/claude-501/s2probe/probe5.ts~probe8.ts)의
// 입력을 그대로 재사용한다.
//
// 컨트롤러 룰링 요약:
//   (a) direct 판정은 ingredientsBody + 찾아낸 모든 함유/알레르기 절 +
//       allergenStatement/crossContaminationStatement 필드 원문 +
//       rawText를 본문·문장 토크나이저 둘 다로 훑는다. label_context는
//       함유/포함/알레르기/알러지/유발물질 단서가 있는 절과
//       allergenStatement 필드에서만 직접 매칭을 허용한다.
//   (b) cross는 순수 가산적이다 — 같은 알레르기가 direct로도 잡히면
//       cross는 버린다(절대 격하하지 않는다).
//   (c) 교차혼입 절의 지배 항목 목록은 "이전 절 경계 ~ 트리거"까지다 —
//       "트리거부터 문장 끝까지"가 아니다. 트리거 뒤 텍스트는 direct.
//   (d) 절을 찾았다고 원재료 본문을 비우지 않는다.
//   (e) 제로폭 문자는 정규식 추출 전에 먼저 걷어낸다.
//   (f) 문장 토크나이저는 '.' '-' '+' '&'도 구분자로 쓰고(소수점 보존),
//       접속 조사(와/과/및/이나/또는)로 쪼갠 조각도 1글자 exact_token과
//       비교한다.
//   (g) '/' 분리는 괄호 안을 자르지 않는다 — 깊이 0에서만 분리한다.

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

// ---- probe5: R1~R5, S1~S2, P1~P3, A2, C2, F1, RAW/RAW2, ZW/ZW2, D1/D2 ----

Deno.test("probe5 R1: 함유 절 뒤에 교차혼입 절이 오는 순서 — 밀/대두 direct, 땅콩 cross", () => {
  assertEquals(
    run("정제수, 설탕\n이 제품은 땅콩을 사용한 제품과 같은 제조시설에서 제조하고 있으며, 밀, 대두를 함유하고 있습니다"),
    ["FOOD-004:cross_contamination", "FOOD-005:direct", "FOOD-006:direct"],
  );
});

Deno.test("probe5 R2: 교차혼입 절 먼저, 그다음 함유", () => {
  assertEquals(
    run("정제수, 설탕\n땅콩과 같은 시설에서 제조, 우유 함유"),
    ["FOOD-002:direct", "FOOD-004:cross_contamination"],
  );
});

// [4차 리뷰 수정, 룰링 R13] 지배 목록은 트리거에 맞닿은 "정확히 용어인
// 토큰"의 연속뿐이다. "설탕"은 용어가 아니므로 목록이 거기서 끝나고,
// 그 앞의 "밀가루"는 direct다(3차의 "문장 맨 앞까지 쓸어가기"를 대체).
Deno.test("probe5 R3: 용어가 아닌 토큰(설탕)에서 지배 목록이 끝난다(R13)", () => {
  assertEquals(
    run("밀가루, 설탕, 땅콩과 같은 제조시설에서 제조, 우유, 대두"),
    ["FOOD-002:direct", "FOOD-004:cross_contamination", "FOOD-005:direct", "FOOD-006:direct"],
  );
});

Deno.test("probe5 R4: full-form 트리거 뒤 원재료도 direct", () => {
  assertEquals(
    run("땅콩, 게를 사용한 제품과 같은 제조시설에서 제조 원재료: 밀가루, 우유, 대두"),
    ["FOOD-002:direct", "FOOD-004:cross_contamination", "FOOD-005:direct", "FOOD-006:direct", "FOOD-009:cross_contamination"],
  );
});

Deno.test("probe5 R5: 혼입 가능 트리거 뒤 원재료도 direct", () => {
  assertEquals(
    run("우유 혼입 가능, 밀가루, 대두"),
    ["FOOD-002:cross_contamination", "FOOD-005:direct", "FOOD-006:direct"],
  );
});

Deno.test("probe5 S1/S2: 한 줄 안에 함유가 일찍 나와도 전부 direct", () => {
  assertEquals(
    run("원재료: 밀가루, 사과과즙 10% 함유, Sulfur Dioxide, 크림, 대두"),
    ["FOOD-002:direct", "FOOD-005:direct", "FOOD-006:direct", "FOOD-019:direct"],
  );
  assertEquals(
    run("밀가루, 난백분, 새우추출물 0.5% 함유, shrimp extract"),
    ["FOOD-001:direct", "FOOD-006:direct", "FOOD-010:direct"],
  );
});

Deno.test("probe5 P1/P2/P3: 괄호 안 '/'와 '.'는 문장·절 구조를 깨지 않는다", () => {
  assertEquals(run("혼합제제(설탕/대두), 밀 함유"), ["FOOD-005:direct", "FOOD-006:direct"]);
  assertEquals(run("혼합제제(설탕/대두)\n밀 함유"), ["FOOD-005:direct", "FOOD-006:direct"]);
  assertEquals(
    run("혼합제제(대두. 우유), 밀 함유"),
    ["FOOD-002:direct", "FOOD-005:direct", "FOOD-006:direct"],
  );
});

Deno.test("probe5 A2: 두 번째, 세 번째 함유 절도 전부 스캔되고 label_context도 직접 매칭된다", () => {
  assertEquals(
    run("밀가루\n알레르기: 우유 함유\n조개류(굴), 알류 함유"),
    ["FOOD-001:direct", "FOOD-002:direct", "FOOD-006:direct", "FOOD-013:direct"],
  );
});

Deno.test("probe5 C2: 교차혼입 전용 두 번째 문장도 잡힌다(첫 번째만이 아니라 전부)", () => {
  assertEquals(
    run("밀가루\n땅콩과 같은 시설에서 제조\n알류, 조개류를 사용한 제품과 같은 제조시설"),
    ["FOOD-001:cross_contamination", "FOOD-004:cross_contamination", "FOOD-006:direct", "FOOD-013:cross_contamination"],
  );
});

Deno.test("probe5 F1: 호출자가 준 crossContaminationStatement 필드도 절 단위로 분리된다", () => {
  assertEquals(
    run("밀가루", "", null, "밀, 대두 함유, 땅콩과 같은 시설에서 제조"),
    ["FOOD-004:cross_contamination", "FOOD-005:direct", "FOOD-006:direct"],
  );
});

Deno.test("probe5 RAW/RAW2: rawText 폴백도 같은 절 분리를 적용한다", () => {
  assertEquals(
    run("밀가루, 설탕", "우유, 대두 함유, 땅콩을 사용한 제품과 같은 제조시설에서 제조하고 있습니다"),
    ["FOOD-002:direct", "FOOD-004:cross_contamination", "FOOD-005:direct", "FOOD-006:direct"],
  );
  assertEquals(
    run("밀가루, 설탕", "땅콩을 사용한 제품과 같은 제조시설에서 제조, 우유, 대두 함유"),
    ["FOOD-002:direct", "FOOD-004:cross_contamination", "FOOD-005:direct", "FOOD-006:direct"],
  );
});

Deno.test("probe5 ZW/ZW2: 제로폭 문자가 '함유'/'같은 시설' 사이에 끼어도 인식한다", () => {
  assertEquals(run("밀가루\n알류 함​유"), ["FOOD-001:direct", "FOOD-006:direct"]);
  assertEquals(run("밀가루\n땅콩과 같은​시설"), ["FOOD-004:cross_contamination", "FOOD-006:direct"]);
});

Deno.test("probe5 D1/D2: 소수점은 문장 경계가 아니고, 한글 사이 '.'은 경계다", () => {
  assertEquals(run("정제수, 설탕 12.5%. 대두, 우유 함유"), ["FOOD-002:direct", "FOOD-005:direct"]);
  assertEquals(run("우유.대두.밀 함유"), ["FOOD-002:direct", "FOOD-005:direct", "FOOD-006:direct"]);
});

// ---- probe6: 파생 표기 + 우육/새우육 negative compound ----

Deno.test("probe6: 새우육수/새우육은 새우(FOOD-010)만 잡고 우육(FOOD-018)은 잡지 않는다", () => {
  assertEquals(ids("새우육수"), ["FOOD-010"]);
  assertEquals(ids("새우육"), ["FOOD-010"]);
  assertEquals(ids(null, "새우육수 함유"), ["FOOD-010"]);
});

Deno.test("probe6: 우육 단독은 여전히 FOOD-018로 잡힌다(부정 합성어가 우육 자체는 막지 않는다)", () => {
  assertEquals(ids("우육"), ["FOOD-018"]);
  assertEquals(ids("닭육수"), ["FOOD-016"]);
});

Deno.test("probe6: 시드 안 phrase 용어 간 교차 기준 포함 관계는 밀가루<in>메밀가루 하나뿐이고 NEGATIVE_COMPOUNDS로 막혀 있다", () => {
  const phraseTerms = ALLERGEN_TERMS.filter((t) => t.matchType === "phrase");
  const containments: Array<[string, string]> = [];
  for (const a of phraseTerms) {
    for (const b of ALLERGEN_TERMS) {
      if (a !== b && a.allergenId !== b.allergenId && b.term.includes(a.term)) {
        containments.push([a.term, b.term]);
      }
    }
  }
  assertEquals(containments, [["밀가루", "메밀가루"]]);
});

// ---- probe7: 구분자·접속 조사·소수점 ----

const SEP_ING_CASES: Array<[string, string[]]> = [
  ["밀|게", ["FOOD-006", "FOOD-009"]],
  ["밀‧게", ["FOOD-006", "FOOD-009"]],
  ["「밀」게", ["FOOD-006", "FOOD-009"]],
  ["밀:게", ["FOOD-006", "FOOD-009"]],
  ["밀ᆞ게", ["FOOD-006", "FOOD-009"]],
  ["밀ㆍ게", ["FOOD-006", "FOOD-009"]],
  ["밀.게", ["FOOD-006", "FOOD-009"]],
  ["밀-게", ["FOOD-006", "FOOD-009"]],
  ["밀+게", ["FOOD-006", "FOOD-009"]],
  ["밀&게", ["FOOD-006", "FOOD-009"]],
  ["게​, 밀", ["FOOD-006", "FOOD-009"]],
];
for (const [text, expected] of SEP_ING_CASES) {
  Deno.test(`probe7 ING: 원재료 구분자 "${text}"`, () => {
    assertEquals(ids(text), expected);
  });
}

const SEP_STMT_CASES: Array<[string, string[]]> = [
  ["밀.게 함유", ["FOOD-006", "FOOD-009"]],
  ["밀|게 함유", ["FOOD-006", "FOOD-009"]],
  ["밀‧게 함유", ["FOOD-006", "FOOD-009"]],
  ["「밀」 함유", ["FOOD-006"]],
  ["<게> 함유", ["FOOD-009"]],
  ["{굴} 함유", ["FOOD-013"]],
  ["밀-게 함유", ["FOOD-006", "FOOD-009"]],
  ["밀+게 함유", ["FOOD-006", "FOOD-009"]],
  ["밀함유됨", ["FOOD-006"]],
  ["밀 함유됨", ["FOOD-006"]],
  ["밀을함유", ["FOOD-006"]],
  ["게와새우함유", ["FOOD-009", "FOOD-010"]],
  ["밀과콩함유", ["FOOD-005", "FOOD-006"]],
  ["알류.우유 함유", ["FOOD-001", "FOOD-002"]],
  ["조개류(굴).밀 함유", ["FOOD-006", "FOOD-013"]],
];
for (const [text, expected] of SEP_STMT_CASES) {
  Deno.test(`probe7 STMT: 표시 문구 "${text}"`, () => {
    assertEquals(ids(null, text), expected);
  });
}

// [S2 리뷰 3차 수정, 룰링 R12] 한글 사이 '.'로 문장이 나뉘어 "알류"가
// 함유 단서와 다른 문장에 떨어져도, label_context가 이제 어디서든
// 원자 토큰으로 매칭되므로 FOOD-001도 함께 잡힌다 — 예전에는 "함유
// 절 안에서만" 제약 때문에 놓쳤다(F2 잔존 사례, 기대값을 바로잡음).
Deno.test("probe7/9: 한글 사이 '.'로 나뉜 문장에서도 label_context가 direct로 잡힌다(R12)", () => {
  assertEquals(
    run("밀가루, 설탕 알류.조개류 함유"),
    ["FOOD-001:direct", "FOOD-006:direct", "FOOD-013:direct"],
  );
  assertEquals(
    run("알류.조개류.밀 함유"),
    ["FOOD-001:direct", "FOOD-006:direct", "FOOD-013:direct"],
  );
  assertEquals(
    run("밀가루\n알류. 조개류 함유"),
    ["FOOD-001:direct", "FOOD-006:direct", "FOOD-013:direct"],
  );
});

Deno.test("probe7: 소수 '1/2컵'은 쪼개지지 않고, 함유 절의 알류도 direct로 잡힌다", () => {
  assertEquals(run("밀가루, 1/2컵, 알류 함유"), ["FOOD-001:direct", "FOOD-006:direct"]);
});

Deno.test("probe7: 여러 함유 절이 모두 스캔된다(우유 함유, 알류 함유 각각 다른 줄)", () => {
  assertEquals(run("밀가루\n우유 함유\n알류 함유"), ["FOOD-001:direct", "FOOD-002:direct", "FOOD-006:direct"]);
});

Deno.test("probe7: 괄호·콜론이 섞인 실제 라벨형 문장 전체", () => {
  assertEquals(
    run(
      "원재료명: 밀가루(밀:미국산 100%), 설탕. 알레르기 유발물질: 알류, 조개류(굴) 함유. 이 제품은 게를 사용한 제품과 같은 제조시설에서 제조",
    ),
    ["FOOD-001:direct", "FOOD-006:direct", "FOOD-009:cross_contamination", "FOOD-013:direct"],
  );
});

// ---- probe8: '/' 분리가 괄호 밖에서도 지배 항목 목록을 깨지 않는다 ----

Deno.test("probe8: 지배 항목 목록 안의 '/'는 트리거 범위를 깨지 않는다(땅콩/게 모두 cross)", () => {
  assertEquals(
    run("밀가루\n땅콩/게를 사용한 제품과 같은 제조시설"),
    ["FOOD-004:cross_contamination", "FOOD-006:direct", "FOOD-009:cross_contamination"],
  );
});

Deno.test("probe8: 함유 절과 교차혼입 절이 '/'로만 붙어 있어도 나뉜다(알류 direct, 땅콩 cross)", () => {
  assertEquals(
    run("밀가루\n알류 함유/ 땅콩과 같은 시설"),
    ["FOOD-001:direct", "FOOD-004:cross_contamination", "FOOD-006:direct"],
  );
});

Deno.test("probe8: 혼입 가능 트리거가 '/'로 이어진 두 항목을 모두 지배한다", () => {
  assertEquals(run("밀가루\n우유/알류 혼입 가능"), ["FOOD-001:cross_contamination", "FOOD-002:cross_contamination", "FOOD-006:direct"]);
});

Deno.test("probe8: 함유 절 안의 '/'(쉼표 대용)도 각 항목을 잡는다", () => {
  assertEquals(run("밀가루, 설탕\n알류/조개류 함유"), ["FOOD-001:direct", "FOOD-006:direct", "FOOD-013:direct"]);
  assertEquals(run("밀가루\n알류, 조개류/갑각류 함유"), ["FOOD-001:direct", "FOOD-006:direct", "FOOD-013:direct"]);
  assertEquals(run("밀가루, 설탕\n조개류(굴/홍합) 함유"), ["FOOD-006:direct", "FOOD-013:direct"]);
});

Deno.test("probe8: '/'로 이어붙인 세 섹션도 전부 direct로 읽힌다(교차혼입 트리거 없음)", () => {
  assertEquals(run("밀가루 / 알류 함유 / 조개류 함유"), ["FOOD-001:direct", "FOOD-006:direct", "FOOD-013:direct"]);
});
