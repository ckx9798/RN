import { assertEquals } from "@std/assert";
import { extractStatements } from "../_shared/domain/label-statements.ts";

Deno.test("extractStatements: 필드가 주어지면 그대로 사용", () => {
  const result = extractStatements({
    ingredientsText: "밀가루, 대두, 우유",
    allergenStatement: "우유, 대두 함유",
    crossContaminationStatement: "땅콩을 사용한 제품과 같은 시설",
    rawText: "",
  });
  assertEquals(result.allergen, "우유, 대두 함유");
  assertEquals(result.crossContamination, "땅콩을 사용한 제품과 같은 시설");
  assertEquals(result.ingredientsBody, "밀가루, 대두, 우유");
});

Deno.test("extractStatements: ingredientsText에서 알레르기 문장 분리(본문에도 남는다, 규칙 d)", () => {
  const result = extractStatements({
    ingredientsText: "밀가루, 대두, 우유\n이 제품은 알레르기 유발물질인 대두, 우유를 함유하고 있습니다.",
    allergenStatement: null,
    crossContaminationStatement: null,
    rawText: "",
  });
  assertEquals(result.allergen, "이 제품은 알레르기 유발물질인 대두, 우유를 함유하고 있습니다");
  assertEquals(result.crossContamination, null);
  // 2차 리뷰 구조 변경: 함유 절을 찾았다고 본문에서 제거하지 않는다 —
  // 본문 토크나이저로도 스캔되도록 그대로 남긴다(중복은 매처가 합친다).
  assertEquals(
    result.ingredientsBody,
    "밀가루, 대두, 우유\n이 제품은 알레르기 유발물질인 대두, 우유를 함유하고 있습니다",
  );
});

Deno.test("extractStatements: ingredientsText에서 교차혼입 문장 분리(범위 판정은 매처가 R13으로)", () => {
  const result = extractStatements({
    ingredientsText: "밀가루, 설탕.이 제품은 땅콩을 사용한 제품과 같은 제조시설에서 제조하고 있습니다.",
    allergenStatement: null,
    crossContaminationStatement: null,
    rawText: "",
  });
  // [4차 리뷰 수정, R13] 이 함수는 트리거가 있는 문장을 통째로 교차혼입
  // 필드로 보낸다(브리프 Step 4). 문장 안에서 무엇이 cross인지는
  // allergen-matcher.ts가 cross-spans.ts(R13)로 판정하고, 지배 목록 밖은
  // direct로 훑는다 — 필드 경계가 결과를 좌우하지 않는다.
  assertEquals(result.crossContamination, "이 제품은 땅콩을 사용한 제품과 같은 제조시설에서 제조하고 있습니다");
  assertEquals(result.ingredientsBody, "밀가루, 설탕");
});

// [3차 리뷰 수정, 룰링 7] rawText는 더는 "ingredientsText가 아무것도
// 못 찾았을 때만" 쓰는 폴백이 아니다 — 항상 direct 판정 대상으로
// 본문에 더해진다. 테스트 이름과 기대값을 그 동작에 맞게 갱신한다.
Deno.test("extractStatements: rawText는 항상 본문에 더해진다(폴백이 아니다, 룰링 7)", () => {
  const result = extractStatements({
    ingredientsText: "밀가루, 설탕, 대두",
    allergenStatement: null,
    crossContaminationStatement: null,
    rawText: "영양성분표\n이 제품은 대두, 밀을 함유하고 있습니다.\n제조원: OO식품",
  });
  assertEquals(result.allergen, "이 제품은 대두, 밀을 함유하고 있습니다");
  assertEquals(
    result.ingredientsBody,
    "밀가루, 설탕, 대두\n영양성분표\n이 제품은 대두, 밀을 함유하고 있습니다\n제조원: OO식품",
  );
});

Deno.test("extractStatements: 일치하는 문장이 전혀 없으면 null", () => {
  const result = extractStatements({
    ingredientsText: "밀가루, 설탕, 정제소금",
    allergenStatement: null,
    crossContaminationStatement: null,
    rawText: "",
  });
  assertEquals(result.allergen, null);
  assertEquals(result.crossContamination, null);
  assertEquals(result.ingredientsBody, "밀가루, 설탕, 정제소금");
});
