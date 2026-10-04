import { assert, assertEquals, assertFalse } from "@std/assert";
import { createAnalyzeFoodHandler } from "../analyze-food/index.ts";
import { createFoodDataHandler } from "../food-data/index.ts";
import { analysisDeps, scan } from "./fixtures/analysis.ts";

function handler(
  overrides: Partial<Parameters<typeof createAnalyzeFoodHandler>[0]> = {},
) {
  return createAnalyzeFoodHandler({
    authenticate: () =>
      Promise.resolve({ userId: "user-A", deps: analysisDeps() }),
    limiter: { take: () => true },
    allowedOrigins: ["https://app.example"],
    ...overrides,
  });
}
function request(
  body: string = JSON.stringify({ scan: scan() }),
  headers: HeadersInit = {},
) {
  return new Request("https://edge.example/analyze-food", {
    method: "POST",
    headers: {
      origin: "https://app.example",
      "content-type": "application/json",
      ...headers,
    },
    body,
  });
}
Deno.test("handler: preflight echoes only allowed origin and allows authorization", async () => {
  const h = handler({
    authenticate: () => {
      throw new Error("preflight must not authenticate");
    },
  });
  const response = await h(
    new Request("https://edge.example", {
      method: "OPTIONS",
      headers: { origin: "https://app.example" },
    }),
  );
  assertEquals(response.status, 204);
  assertEquals(
    response.headers.get("access-control-allow-origin"),
    "https://app.example",
  );
  assert(
    response.headers.get("access-control-allow-headers")?.includes(
      "authorization",
    ),
  );
  const rejected = await h(
    new Request("https://edge.example", {
      method: "OPTIONS",
      headers: { origin: "https://evil.example" },
    }),
  );
  assertEquals(rejected.headers.get("access-control-allow-origin"), null);
});
Deno.test("handler: GET is 405 and no authentication", async () => {
  const response = await handler({
    authenticate: () => {
      throw new Error("must not authenticate");
    },
  })(new Request("https://edge.example"));
  assertEquals(response.status, 405);
  assertEquals(response.headers.get("allow"), "POST, OPTIONS");
});
Deno.test("handler: unauthorized", async () => {
  const response = await handler({ authenticate: () => Promise.resolve(null) })(
    request(),
  );
  assertEquals(response.status, 401);
  assertEquals((await response.json()).error.code, "unauthorized");
});
Deno.test("handler: oversized declared and streamed bodies including multibyte text", async () => {
  for (
    const req of [
      request("{}", { "content-length": "49153" }),
      request("가".repeat(20000), { "content-length": "1" }),
    ]
  ) {
    const response = await handler()(req);
    assertEquals(response.status, 413);
    assertEquals((await response.json()).error.code, "payload_too_large");
  }
});
Deno.test("handler: invalid JSON, invalid scan and missing profile are 400", async () => {
  for (
    const body of [
      "{",
      "{}",
      JSON.stringify({ scan: { ...scan(), userReviewed: false } }),
    ]
  ) assertEquals((await handler()(request(body))).status, 400);
  const response = await handler({
    authenticate: () =>
      Promise.resolve({
        userId: "user-A",
        deps: analysisDeps({ loadProfile: () => Promise.resolve(null) }),
      }),
  })(request());
  assertEquals(response.status, 400);
  assertEquals((await response.json()).error.message, "profile_required");
});
Deno.test("handler: quota keyed by verified user id", async () => {
  let key = "";
  const response = await handler({
    limiter: {
      take: (value) => {
        key = value;
        return false;
      },
    },
  })(request());
  assertEquals(key, "user-A");
  assertEquals(response.status, 429);
});
Deno.test("handler: response never echoes private rawText, no-store and CORS on success", async () => {
  const response = await handler()(request());
  const text = await response.text();
  assertEquals(response.status, 200);
  assertFalse(text.includes("비공개 교정 원문"));
  assertEquals(JSON.parse(text).analysisId, "saved-analysis");
  assertEquals(response.headers.get("cache-control"), "no-store");
  assertEquals(
    response.headers.get("access-control-allow-origin"),
    "https://app.example",
  );
});
Deno.test("handler: dependency and auth errors do not disclose private exception in response or log", async () => {
  const original = console.log;
  const logs: unknown[] = [];
  console.log = (...args) => {
    logs.push(args);
  };
  try {
    for (
      const authenticate of [() => {
        throw new Error("PRIVATE_TOKEN private@example.com");
      }, () =>
        Promise.resolve({
          userId: "user-A",
          deps: analysisDeps({
            save: () => {
              throw new Error("PRIVATE_TOKEN private@example.com");
            },
          }),
        })]
    ) {
      const response = await handler({ authenticate })(request());
      assertEquals(response.status, 500);
      assertEquals((await response.json()).error, {
        code: "internal",
        message: "요청을 처리하지 못했어요",
      });
    }
  } finally {
    console.log = original;
  }
  assertFalse(JSON.stringify(logs).includes("PRIVATE_TOKEN"));
  assertFalse(JSON.stringify(logs).includes("private@example.com"));
});
Deno.test("handler: disallowed origin rejected before sensitive operations", async () => {
  const response = await handler({
    authenticate: () => {
      throw new Error("must not authenticate");
    },
  })(request(undefined, { origin: "https://evil.example" }));
  assertEquals(response.status, 400);
  assertEquals(response.headers.get("access-control-allow-origin"), null);
});
Deno.test("food-data: authenticated validated query reaches product search", async () => {
  const h = createFoodDataHandler({
    authenticate: () =>
      Promise.resolve({
        userId: "user-B",
        products: {
          search(query, manufacturer) {
            assertEquals(query, "과자");
            assertEquals(manufacturer, "제조사");
            return Promise.resolve([{
              id: "candidate",
              reportNumber: null,
              name: "과자",
              manufacturer: "제조사",
              score: 0.8,
            }]);
          },
        },
      }),
    limiter: { take: () => true },
    allowedOrigins: ["https://app.example"],
  });
  const response = await h(
    request(JSON.stringify({ query: " 과자 ", manufacturer: "제조사" })),
  );
  assertEquals(response.status, 200);
  assertEquals((await response.json()).candidates.length, 1);
  assertEquals((await h(request("{}"))).status, 400);
});
