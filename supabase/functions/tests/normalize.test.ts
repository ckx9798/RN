import { assertEquals } from "@std/assert";
import { normalizeName, normalizeText } from "../_shared/domain/normalize.ts";

Deno.test("normalizeText: NFKC, 소문자, 공백 정리", () => {
  assertEquals(normalizeText("  Ｃｒａｂ  추출물 "), "crab 추출물");
});

Deno.test("normalizeText: 탭·개행도 공백 1칸으로 축소", () => {
  assertEquals(normalizeText("밀가루\t\n대두"), "밀가루 대두");
});

Deno.test("normalizeText: 빈 문자열은 빈 문자열", () => {
  assertEquals(normalizeText("   "), "");
});

Deno.test("normalizeName: 공백·괄호·특수문자 제거, 한글·영숫자만 유지", () => {
  assertEquals(normalizeName("농심(주) 신라면 Cup 65g"), "농심주신라면cup65g");
});

Deno.test("normalizeName: 하이픈·슬래시 등 구두점 제거", () => {
  assertEquals(normalizeName("오뚜기 진라면-매운맛 120g/개"), "오뚜기진라면매운맛120g개");
});
