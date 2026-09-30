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

Deno.test("extractStatements: ingredientsText에서 교차혼입 절 분리(트리거~문장 끝이 아니라 지배 항목까지만, 규칙 c)", () => {
  const result = extractStatements({
    ingredientsText: "밀가루, 설탕.이 제품은 땅콩을 사용한 제품과 같은 제조시설에서 제조하고 있습니다.",
    allergenStatement: null,
    crossContaminationStatement: null,
    rawText: "",
  });
  // 2차 리뷰 구조 변경: 교차혼입 절은 지배 항목 목록(트리거 문구까지)만
  // 담는다 — 예전처럼 "트리거부터 문장 끝까지"를 통째로 담지 않는다.
  // 트리거 뒤 텍스트("에서 제조하고 있습니다")는 직접 판정 대상으로
  // 본문에 남는다.
  // [3차 리뷰 수정, 룰링 6] "이 제품은"도 절 경계로 보고 그 앞은 잘라낸다
  // (여기서는 문장 맨 앞이라 잘라낼 게 없어 매칭 결과에는 영향이 없다 —
  // crossContamination 문자열에서 "이 제품은"이 빠질 뿐이다).
  assertEquals(result.crossContamination, "땅콩을 사용한 제품과 같은 제조시설");
  // "이 제품은"은 절 경계 표식으로만 쓰이고 그 자체는 direct 쪽(본문)에
  // 남는다(룰링 6) — 용어가 아니라서 매칭에는 영향이 없다.
  assertEquals(result.ingredientsBody, "밀가루, 설탕\n이 제품은 에서 제조하고 있습니다");
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
