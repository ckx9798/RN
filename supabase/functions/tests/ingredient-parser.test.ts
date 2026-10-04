import { assertEquals } from "@std/assert";
import { flattenAtoms, parseIngredients } from "../_shared/domain/ingredient-parser.ts";

Deno.test("parseIngredients: 구분자(쉼표·가운데점·슬래시·개행) 혼합, 중첩 괄호 보존", () => {
  const nodes = parseIngredients(
    "밀가루(밀:미국산), 혼합제제[설탕, 대두레시틴(대두)]·정제소금/난백분\n버터",
  );

  assertEquals(nodes.map((n) => n.raw), ["밀가루", "혼합제제", "정제소금", "난백분", "버터"]);

  const wheat = nodes[0];
  assertEquals(wheat.children.map((c) => c.raw), ["밀:미국산"]);

  const mixed = nodes[1];
  assertEquals(mixed.children.map((c) => c.raw), ["설탕", "대두레시틴"]);
  const soyLecithin = mixed.children[1];
  assertEquals(soyLecithin.children.map((c) => c.raw), ["대두"]);
});

Deno.test("parseIngredients: 짝이 맞지 않는 괄호도 예외 없이 처리", () => {
  const nodes = parseIngredients("밀가루(밀");
  assertEquals(nodes.length, 1);
  assertEquals(nodes[0].raw, "밀가루");
  assertEquals(nodes[0].children.map((c) => c.raw), ["밀"]);
});

Deno.test("parseIngredients: 빈 입력은 빈 배열", () => {
  assertEquals(parseIngredients(""), []);
  assertEquals(parseIngredients("   "), []);
});

Deno.test("flattenAtoms: 콜론으로 원자 토큰 분리", () => {
  const nodes = parseIngredients("밀:미국산");
  assertEquals(flattenAtoms(nodes), ["밀", "미국산"]);
});

Deno.test("flattenAtoms: 퍼센트 수치 토큰 제거", () => {
  const nodes = parseIngredients("정제수 12.5%");
  assertEquals(flattenAtoms(nodes), ["정제수"]);
});

Deno.test("flattenAtoms: 모든 깊이를 포함한다", () => {
  const nodes = parseIngredients("혼합제제[설탕, 대두레시틴(대두)]");
  const atoms = flattenAtoms(nodes);
  assertEquals(atoms, ["혼합제제", "설탕", "대두레시틴", "대두"]);
});
