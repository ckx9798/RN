import { allowedWebOrigins, corsHeaders } from "./cors.ts";
import { logEvent } from "./logger.ts";
import { MAX_REQUEST_BYTES } from "./request-validation.ts";
import { errorResponse, jsonResponse } from "./responses.ts";

class BodyTooLarge extends Error {}
async function readJson(req: Request): Promise<unknown> {
  const declared = Number(req.headers.get("content-length"));
  if (declared > MAX_REQUEST_BYTES) throw new BodyTooLarge();
  if (!req.body) throw new SyntaxError();
  const reader = req.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > MAX_REQUEST_BYTES) {
        await reader.cancel();
        throw new BodyTooLarge();
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.length;
  }
  return JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
}

/** Shared request boundary for both functions; never logs payloads or exceptions. */
export function createPostHandler<User extends { userId: string }, Input>(
  deps: {
    authenticate(req: Request): Promise<User | null>;
    limiter: { take(key: string): boolean };
    allowedOrigins?: string[];
    parse(
      body: unknown,
    ): { ok: true; value: Input } | { ok: false; message: string };
    execute(input: Input, user: User): Promise<unknown>;
  },
): (req: Request) => Promise<Response> {
  const origins = deps.allowedOrigins ?? allowedWebOrigins();
  return async (req) => {
    const headers = corsHeaders(req, origins);
    const origin = req.headers.get("origin");
    if (origin && !origins.includes(origin)) {
      return errorResponse(
        "invalid_request",
        "허용되지 않은 요청 출처예요",
        400,
        headers,
      );
    }
    if (req.method === "OPTIONS") {
      return new Response(null, { status: 204, headers });
    }
    if (req.method !== "POST") {
      headers.set("Allow", "POST, OPTIONS");
      return errorResponse(
        "invalid_request",
        "POST 요청을 사용해 주세요",
        405,
        headers,
      );
    }
    const startedAt = Date.now();
    try {
      const user = await deps.authenticate(req);
      if (!user) {
        return errorResponse("unauthorized", "로그인이 필요해요", 401, headers);
      }
      if (!deps.limiter.take(user.userId)) {
        headers.set("Retry-After", "60");
        return errorResponse(
          "rate_limited",
          "잠시 후 다시 시도해 주세요",
          429,
          headers,
        );
      }
      let body: unknown;
      try {
        body = await readJson(req);
      } catch (error) {
        if (error instanceof BodyTooLarge) {
          return errorResponse(
            "payload_too_large",
            "요청 크기가 너무 커요",
            413,
            headers,
          );
        }
        return errorResponse(
          "invalid_request",
          "요청 형식을 확인해 주세요",
          400,
          headers,
        );
      }
      const parsed = deps.parse(body);
      if (!parsed.ok) {
        return errorResponse("invalid_request", parsed.message, 400, headers);
      }
      const result = await deps.execute(parsed.value, user);
      if (
        result !== null && typeof result === "object" && "error" in result &&
        result.error === "profile_required"
      ) {
        return errorResponse(
          "invalid_request",
          "profile_required",
          400,
          headers,
        );
      }
      logEvent("request_completed", {
        status: 200,
        durationMs: Date.now() - startedAt,
      });
      return jsonResponse(result, 200, headers);
    } catch {
      logEvent("request_failed", {
        status: 500,
        code: "internal",
        durationMs: Date.now() - startedAt,
      });
      return errorResponse(
        "internal",
        "요청을 처리하지 못했어요",
        500,
        headers,
      );
    }
  };
}
