import { assertEquals, assertRejects } from "@std/assert";
import { createFoodSafetyC002Client } from "../_shared/data/foodsafety-c002-client.ts";
import { PublicApiError } from "../_shared/data/http-client.ts";
import type { FetchLike } from "../_shared/data/http-client.ts";

const FAKE_API_KEY = "TEST-C002-KEY-SHOULD-NOT-LEAK";

function jsonResponse(body: unknown, init?: ResponseInit): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "content-type": "application/json" },
    ...init,
  });
}

function successBody(rows: Record<string, unknown>[]) {
  return {
    C002: {
      RESULT: { CODE: "INFO-000", MSG: "정상 처리되었습니다." },
      row: rows,
      total_count: String(rows.length),
    },
  };
}

function noDataBody() {
  return {
    C002: {
      RESULT: { CODE: "INFO-200", MSG: "해당하는 데이터가 없습니다." },
    },
  };
}

Deno.test("foodsafety-c002-client: 정상 응답을 PublicProductRecord로 매핑한다", async () => {
  const row = {
    PRDLST_REPORT_NO: "20230012345",
    PRDLST_NM: "테스트 과자",
    BSSH_NM: "테스트제과",
    PRDLST_DCNM: "과자",
    RAWMTRL_NM: "밀가루, 설탕, 대두유",
    CHNG_DT: "20240115",
  };
  let receivedUrl = "";
  const fetcher: FetchLike = (url) => {
    receivedUrl = url;
    return Promise.resolve(jsonResponse(successBody([row])));
  };

  const client = createFoodSafetyC002Client({ apiKey: FAKE_API_KEY, fetcher });
  const records = await client.search({ name: "테스트 과자" });

  assertEquals(records.length, 1);
  const record = records[0];
  assertEquals(record.service, "foodsafety_c002");
  assertEquals(record.name, "테스트 과자");
  assertEquals(record.manufacturer, "테스트제과");
  assertEquals(record.reportNumber, "20230012345");
  assertEquals(record.foodType, "과자");
  assertEquals(record.ingredientsText, "밀가루, 설탕, 대두유");
  assertEquals(record.sourceUpdatedAt, "2024-01-15");
  assertEquals(record.nutrients, null);
  if (!receivedUrl.includes(FAKE_API_KEY) && !receivedUrl.includes(encodeURIComponent(FAKE_API_KEY))) {
    throw new Error("API 키가 요청 URL에 포함되어야 한다");
  }
});

Deno.test("foodsafety-c002-client: 누락 취급 값은 null로 처리한다", async () => {
  const row = {
    PRDLST_REPORT_NO: "-",
    PRDLST_NM: "누락 테스트",
    BSSH_NM: "",
    PRDLST_DCNM: "N/A",
    RAWMTRL_NM: "-",
    CHNG_DT: "",
  };
  const fetcher: FetchLike = () => Promise.resolve(jsonResponse(successBody([row])));
  const client = createFoodSafetyC002Client({ apiKey: FAKE_API_KEY, fetcher });
  const [record] = await client.search({ name: "누락 테스트" });

  assertEquals(record.reportNumber, null);
  assertEquals(record.manufacturer, null);
  assertEquals(record.foodType, null);
  assertEquals(record.ingredientsText, null);
  assertEquals(record.sourceUpdatedAt, null);
});

Deno.test("foodsafety-c002-client: INFO-200(데이터 없음)이면 빈 배열", async () => {
  const fetcher: FetchLike = () => Promise.resolve(jsonResponse(noDataBody()));
  const client = createFoodSafetyC002Client({ apiKey: FAKE_API_KEY, fetcher });
  const records = await client.search({ reportNumber: "00000000000" });
  assertEquals(records, []);
});

Deno.test("foodsafety-c002-client: RESULT.CODE가 INFO-000 외(에러)이면 PublicApiError", async () => {
  const fetcher: FetchLike = () =>
    Promise.resolve(
      jsonResponse({ C002: { RESULT: { CODE: "INFO-100", MSG: "인증키가 유효하지 않습니다." } } }),
    );
  const client = createFoodSafetyC002Client({ apiKey: FAKE_API_KEY, fetcher });

  const err = await assertRejects(() => client.search({ name: "x" }), PublicApiError);
  assertEquals((err as PublicApiError).service, "foodsafety_c002");
});

Deno.test("foodsafety-c002-client: HTTP 500이면 PublicApiError('http')", async () => {
  const fetcher: FetchLike = () => Promise.resolve(new Response("error", { status: 500 }));
  const client = createFoodSafetyC002Client({ apiKey: FAKE_API_KEY, fetcher });

  const err = await assertRejects(() => client.search({ name: "x" }), PublicApiError);
  assertEquals((err as PublicApiError).reason, "http");
});

Deno.test("foodsafety-c002-client: 지연 응답은 timeoutMs에서 PublicApiError('timeout')", async () => {
  const fetcher: FetchLike = (_url, init) =>
    new Promise((resolve, reject) => {
      const id = setTimeout(() => resolve(jsonResponse(successBody([]))), 500);
      init?.signal?.addEventListener("abort", () => {
        clearTimeout(id);
        reject(new DOMException("aborted", "AbortError"));
      });
    });
  const client = createFoodSafetyC002Client({ apiKey: FAKE_API_KEY, fetcher, timeoutMs: 50 });

  const err = await assertRejects(() => client.search({ name: "x" }), PublicApiError);
  assertEquals((err as PublicApiError).reason, "timeout");
});

Deno.test("foodsafety-c002-client: 키 없음이면 네트워크 호출 없이 PublicApiError('config')", async () => {
  let called = false;
  const fetcher: FetchLike = () => {
    called = true;
    return Promise.resolve(jsonResponse(successBody([])));
  };
  const client = createFoodSafetyC002Client({ apiKey: "", fetcher });

  const err = await assertRejects(() => client.search({ name: "x" }), PublicApiError);
  assertEquals((err as PublicApiError).reason, "config");
  assertEquals(called, false);
});

Deno.test("foodsafety-c002-client: 에러 메시지에는 API 키가 노출되지 않는다", async () => {
  const fetcher: FetchLike = () => Promise.resolve(new Response("error", { status: 500 }));
  const client = createFoodSafetyC002Client({ apiKey: FAKE_API_KEY, fetcher });

  try {
    await client.search({ name: "x" });
    throw new Error("에러가 발생해야 한다");
  } catch (err) {
    const serialized = `${(err as Error).message} ${JSON.stringify(err)}`;
    if (serialized.includes(FAKE_API_KEY)) {
      throw new Error("에러 메시지/직렬화 결과에 API 키가 포함되면 안 된다");
    }
  }
});
