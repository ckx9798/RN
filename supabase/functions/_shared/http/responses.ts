import type { ApiError } from "../domain/types.ts";
export function jsonResponse(
  body: unknown,
  status: number,
  headers: Headers,
): Response {
  const responseHeaders = new Headers(headers);
  responseHeaders.set("Content-Type", "application/json; charset=utf-8");
  responseHeaders.set("Cache-Control", "no-store");
  return new Response(JSON.stringify(body), {
    status,
    headers: responseHeaders,
  });
}
export function errorResponse(
  code: ApiError["error"]["code"],
  message: string,
  status: number,
  headers: Headers,
): Response {
  return jsonResponse({ error: { code, message } }, status, headers);
}
