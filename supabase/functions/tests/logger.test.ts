import { assertEquals, assertFalse, assertStringIncludes } from "@std/assert";
import { logEvent } from "../_shared/http/logger.ts";

Deno.test("logger: only allowed fields, email masked and private fields discarded", () => {
  const original = console.log;
  const output: unknown[][] = [];
  console.log = (...args: unknown[]) => {
    output.push(args);
  };
  try {
    logEvent("analysis", {
      status: "john@example.com",
      code: "ok",
      durationMs: 3,
      rawText: "비공개 원문",
      token: "SECRET",
      disease: "질환",
    });
  } finally {
    console.log = original;
  }
  const text = JSON.stringify(output);
  assertStringIncludes(text, "j***@example.com");
  for (const privateValue of ["john@", "비공개 원문", "SECRET", "질환"]) {
    assertFalse(text.includes(privateValue));
  }
  assertEquals(output.length, 1);
});
