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

Deno.test("extractStatements: ingredientsText에서 알레르기 문장 분리", () => {
  const result = extractStatements({
    ingredientsText: "밀가루, 대두, 우유\n이 제품은 알레르기 유발물질인 대두, 우유를 함유하고 있습니다.",
    allergenStatement: null,
    crossContaminationStatement: null,
    rawText: "",
  });
  assertEquals(result.allergen, "이 제품은 알레르기 유발물질인 대두, 우유를 함유하고 있습니다");
  assertEquals(result.crossContamination, null);
  assertEquals(result.ingredientsBody, "밀가루, 대두, 우유");
});

Deno.test("extractStatements: ingredientsText에서 교차혼입 문장 분리", () => {
  const result = extractStatements({
    ingredientsText: "밀가루, 설탕.이 제품은 땅콩을 사용한 제품과 같은 제조시설에서 제조하고 있습니다.",
    allergenStatement: null,
    crossContaminationStatement: null,
    rawText: "",
  });
  assertEquals(result.crossContamination, "이 제품은 땅콩을 사용한 제품과 같은 제조시설에서 제조하고 있습니다");
  assertEquals(result.ingredientsBody, "밀가루, 설탕");
});

Deno.test("extractStatements: ingredientsText에 없으면 rawText에서 찾는다(ingredientsBody는 유지)", () => {
  const result = extractStatements({
    ingredientsText: "밀가루, 설탕, 대두",
    allergenStatement: null,
    crossContaminationStatement: null,
    rawText: "영양성분표\n이 제품은 대두, 밀을 함유하고 있습니다.\n제조원: OO식품",
  });
  assertEquals(result.allergen, "이 제품은 대두, 밀을 함유하고 있습니다");
  assertEquals(result.ingredientsBody, "밀가루, 설탕, 대두");
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
