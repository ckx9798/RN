import { assertEquals, assertRejects } from "@std/assert";
import { createMfdsNutritionClient } from "../_shared/data/mfds-nutrition-client.ts";
import { PublicApiError } from "../_shared/data/http-client.ts";
import type { FetchLike } from "../_shared/data/http-client.ts";

const FAKE_SERVICE_KEY = "TEST-SERVICE-KEY-SHOULD-NOT-LEAK";

function jsonResponse(body: unknown, init?: ResponseInit): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "content-type": "application/json" },
    ...init,
  });
}

function successBody(items: Record<string, unknown>[]) {
  return {
    response: {
      header: { resultCode: "00", resultMsg: "NORMAL_SERVICE" },
      body: { items, totalCount: items.length },
    },
  };
}

Deno.test("mfds-nutrition-client: 정상 응답을 PublicProductRecord로 매핑한다", async () => {
  const item = {
    FOOD_NM_KR: "테스트 과자",
    MAKER_NM: "테스트제과",
    ITEM_REPORT_NO: "20230012345",
    FOOD_CAT1_NM: "과자류",
    SERVING_SIZE: "30g",
    AMT_NUM1: "150",
    AMT_NUM3: "2.5",
    AMT_NUM4: "6",
    AMT_NUM6: "20",
    AMT_NUM7: "10",
    AMT_NUM9: "10",
    AMT_NUM11: "20",
    AMT_NUM12: "30",
    AMT_NUM13: "120",
    AMT_NUM24: "1.5",
    AMT_NUM23: "0",
    UPDATE_DATE: "20240115",
  };
  let receivedUrl = "";
  const fetcher: FetchLike = (url) => {
    receivedUrl = url;
    return Promise.resolve(jsonResponse(successBody([item])));
  };

  const client = createMfdsNutritionClient({ serviceKey: FAKE_SERVICE_KEY, fetcher });
  const records = await client.search({ name: "테스트 과자" });

  assertEquals(records.length, 1);
  const record = records[0];
  assertEquals(record.service, "mfds_nutrition");
  assertEquals(record.name, "테스트 과자");
  assertEquals(record.manufacturer, "테스트제과");
  assertEquals(record.reportNumber, "20230012345");
  assertEquals(record.foodType, "과자류");
  assertEquals(record.servingSize, "30g");
  assertEquals(record.sourceUpdatedAt, "2024-01-15");
  assertEquals(record.ingredientsText, null);
  assertEquals(record.nutrients, {
    energy: { value: 150, unit: "kcal" },
    protein: { value: 2.5, unit: "g" },
    fat: { value: 6, unit: "g" },
    carbohydrate: { value: 20, unit: "g" },
    sugars: { value: 10, unit: "g" },
    calcium: { value: 10, unit: "mg" },
    phosphorus: { value: 20, unit: "mg" },
    potassium: { value: 30, unit: "mg" },
    sodium: { value: 120, unit: "mg" },
    saturated_fat: { value: 1.5, unit: "g" },
    cholesterol: { value: 0, unit: "mg" },
  });
  // 서비스 키는 쿼리스트링에 들어가되, 기대한 URL에만 포함된다(정상 동작 확인용).
  if (!receivedUrl.includes(encodeURIComponent(FAKE_SERVICE_KEY)) && !receivedUrl.includes(FAKE_SERVICE_KEY)) {
    throw new Error("서비스 키가 요청 URL에 포함되어야 한다");
  }
});

Deno.test("mfds-nutrition-client: 빈 문자열·'-'·'N/A' 수치는 누락으로 처리한다(0 아님)", async () => {
  const item = {
    FOOD_NM_KR: "누락 테스트",
    MAKER_NM: "-",
    ITEM_REPORT_NO: "",
    FOOD_CAT1_NM: "N/A",
    SERVING_SIZE: "",
    AMT_NUM1: "",
    AMT_NUM3: "-",
    AMT_NUM4: "N/A",
    AMT_NUM6: "0",
    UPDATE_DATE: "",
  };
  const fetcher: FetchLike = () => Promise.resolve(jsonResponse(successBody([item])));
  const client = createMfdsNutritionClient({ serviceKey: FAKE_SERVICE_KEY, fetcher });
  const [record] = await client.search({ name: "누락 테스트" });

  assertEquals(record.manufacturer, null);
  assertEquals(record.reportNumber, null);
  assertEquals(record.foodType, null);
  assertEquals(record.servingSize, null);
  assertEquals(record.sourceUpdatedAt, null);
  // 0은 유효한 수치이므로 누락 처리하지 않는다.
  assertEquals(record.nutrients?.carbohydrate, { value: 0, unit: "g" });
  assertEquals(record.nutrients?.energy, undefined);
  assertEquals(record.nutrients?.protein, undefined);
  assertEquals(record.nutrients?.fat, undefined);
});

Deno.test("mfds-nutrition-client: HTTP 500이면 PublicApiError('http')", async () => {
  const fetcher: FetchLike = () =>
    Promise.resolve(new Response("server error", { status: 500 }));
  const client = createMfdsNutritionClient({ serviceKey: FAKE_SERVICE_KEY, fetcher });

  const err = await assertRejects(
    () => client.search({ name: "x" }),
    PublicApiError,
  );
  assertEquals((err as PublicApiError).reason, "http");
  assertEquals((err as PublicApiError).service, "mfds_nutrition");
});

Deno.test("mfds-nutrition-client: 지연 응답은 timeoutMs에서 PublicApiError('timeout')", async () => {
  const fetcher: FetchLike = (_url, init) =>
    new Promise((resolve, reject) => {
      const id = setTimeout(() => resolve(jsonResponse(successBody([]))), 500);
      init?.signal?.addEventListener("abort", () => {
        clearTimeout(id);
        reject(new DOMException("aborted", "AbortError"));
      });
    });
  const client = createMfdsNutritionClient({ serviceKey: FAKE_SERVICE_KEY, fetcher, timeoutMs: 50 });

  const err = await assertRejects(
    () => client.search({ name: "x" }),
    PublicApiError,
  );
  assertEquals((err as PublicApiError).reason, "timeout");
});

Deno.test("mfds-nutrition-client: 키 없음이면 네트워크 호출 없이 PublicApiError('config')", async () => {
  let called = false;
  const fetcher: FetchLike = () => {
    called = true;
    return Promise.resolve(jsonResponse(successBody([])));
  };
  const client = createMfdsNutritionClient({ serviceKey: "", fetcher });

  const err = await assertRejects(
    () => client.search({ name: "x" }),
    PublicApiError,
  );
  assertEquals((err as PublicApiError).reason, "config");
  assertEquals(called, false);
});

Deno.test("mfds-nutrition-client: 에러 메시지에는 서비스 키가 노출되지 않는다", async () => {
  const fetcher: FetchLike = () => Promise.resolve(new Response("error", { status: 500 }));
  const client = createMfdsNutritionClient({ serviceKey: FAKE_SERVICE_KEY, fetcher });

  try {
    await client.search({ name: "x" });
    throw new Error("에러가 발생해야 한다");
  } catch (err) {
    const serialized = `${(err as Error).message} ${JSON.stringify(err)}`;
    if (serialized.includes(FAKE_SERVICE_KEY)) {
      throw new Error("에러 메시지/직렬화 결과에 서비스 키가 포함되면 안 된다");
    }
  }
});
