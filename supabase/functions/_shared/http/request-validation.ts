import type { AnalyzeFoodRequest } from "../domain/types.ts";
// 브리지 SCAN_RESULT 상한(64KB) + 요청 래퍼(selectedProductId) 여유분.
export const MAX_REQUEST_BYTES = 80 * 1024;
type Parsed<T> = { ok: true; value: T } | { ok: false; message: string };
export function containsForbiddenContent(value: string): boolean {
  return /data:[a-z]+\/[a-z0-9.+-]+;base64,/i.test(value) ||
    /\b(file|content|ph|assets-library):\/\//i.test(value) ||
    /[A-Za-z0-9+/=]{500,}/.test(value) ||
    /\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\./.test(value);
}
function object(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}
function onlyKeys(value: Record<string, unknown>, keys: string[]): boolean {
  return Object.keys(value).every((key) => keys.includes(key));
}
function text(value: unknown, max: number): value is string {
  return typeof value === "string" && value.length <= max &&
    !containsForbiddenContent(value);
}
function nullableText(value: unknown, max: number): value is string | null {
  return value === null || text(value, max);
}
export function parseAnalyzeFoodRequest(
  body: unknown,
): Parsed<AnalyzeFoodRequest> {
  const invalid = { ok: false, message: "invalid_request" } as const;
  if (!object(body) || !onlyKeys(body, ["scan", "selectedProductId"])) {
    return invalid;
  }
  const s = body.scan;
  if (
    !object(s) ||
    !onlyKeys(s, [
      "productName",
      "manufacturer",
      "reportNumber",
      "ingredientsText",
      "allergenStatement",
      "crossContaminationStatement",
      "rawText",
      "userReviewed",
    ])
  ) return invalid;
  if (
    !nullableText(s.productName, 200) || !nullableText(s.manufacturer, 200) ||
    !nullableText(s.reportNumber, 20) ||
    (s.reportNumber !== null && !/^\d{1,20}$/.test(s.reportNumber)) ||
    !text(s.ingredientsText, 8000) || !s.ingredientsText.trim() ||
    !nullableText(s.allergenStatement, 1000) ||
    !nullableText(s.crossContaminationStatement, 1000) ||
    !text(s.rawText, 20000) || s.userReviewed !== true
  ) return invalid;
  const id = body.selectedProductId;
  if (
    id !== undefined && id !== null &&
    (typeof id !== "string" ||
      !/^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(id))
  ) return invalid;
  return {
    ok: true,
    value: {
      scan: {
        productName: s.productName,
        manufacturer: s.manufacturer,
        reportNumber: s.reportNumber,
        ingredientsText: s.ingredientsText,
        allergenStatement: s.allergenStatement,
        crossContaminationStatement: s.crossContaminationStatement,
        rawText: s.rawText,
        userReviewed: true,
      },
      ...(id === undefined ? {} : { selectedProductId: id }),
    },
  };
}
export function parseFoodDataRequest(
  body: unknown,
): Parsed<{ query: string; manufacturer: string | null }> {
  const invalid = { ok: false, message: "invalid_request" } as const;
  if (
    !object(body) || !onlyKeys(body, ["query", "manufacturer"]) ||
    !text(body.query, 100)
  ) return invalid;
  const query = body.query.trim();
  if (query.length < 2 || !nullableText(body.manufacturer ?? null, 200)) {
    return invalid;
  }
  return {
    ok: true,
    value: {
      query,
      manufacturer: typeof body.manufacturer === "string"
        ? body.manufacturer.trim()
        : null,
    },
  };
}
