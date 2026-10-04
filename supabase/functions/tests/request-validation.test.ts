import { assertEquals } from "@std/assert";
import {
  containsForbiddenContent,
  parseAnalyzeFoodRequest,
  parseFoodDataRequest,
} from "../_shared/http/request-validation.ts";
import { scan } from "./fixtures/analysis.ts";

Deno.test("validation: valid scan and selected UUID survive unchanged", () => {
  const body = {
    scan: scan(),
    selectedProductId: "12345678-1234-1234-1234-123456789abc",
  };
  assertEquals(parseAnalyzeFoodRequest(body), { ok: true, value: body });
});
for (
  const [name, body] of Object.entries({
    missing: {},
    null: null,
    array: [],
    extra: { scan: scan(), user_id: "other" },
    image: { scan: { ...scan(), imageBase64: "abc" } },
    unreviewed: { scan: { ...scan(), userReviewed: false } },
    empty: { scan: { ...scan(), ingredientsText: " \n " } },
    long: { scan: { ...scan(), ingredientsText: "가".repeat(8001) } },
    wrongType: { scan: { ...scan(), productName: 3 } },
    badReport: { scan: { ...scan(), reportNumber: "123-45" } },
    badId: { scan: scan(), selectedProductId: "not-a-uuid" },
  })
) {
  Deno.test(`validation: rejects ${name}`, () =>
    assertEquals(parseAnalyzeFoodRequest(body).ok, false));
}

for (
  const value of [
    "data:image/png;base64,abc",
    "file:///tmp/image",
    "content://photo",
    "ph://photo",
    "assets-library://photo",
    "A".repeat(500),
    "eyJabcdefghijk.abcdefghijk.signature",
  ]
) {
  Deno.test(`validation: rejects forbidden content ${value.slice(0, 25)}`, () => {
    assertEquals(containsForbiddenContent(value), true);
    assertEquals(
      parseAnalyzeFoodRequest({ scan: { ...scan(), rawText: value } }).ok,
      false,
    );
    assertEquals(parseFoodDataRequest({ query: value }).ok, false);
  });
}
Deno.test("food-data validation: trims query and defaults manufacturer", () => {
  assertEquals(parseFoodDataRequest({ query: " 과자 " }), {
    ok: true,
    value: { query: "과자", manufacturer: null },
  });
  for (
    const body of [
      { query: " " },
      { query: "가" },
      { query: "가".repeat(101) },
      { query: "과자", user_id: "x" },
      { query: "과자", manufacturer: 4 },
    ]
  ) {
    assertEquals(parseFoodDataRequest(body).ok, false);
  }
});
