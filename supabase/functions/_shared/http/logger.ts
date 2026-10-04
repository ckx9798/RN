const ALLOWED_FIELDS = new Set([
  "status",
  "code",
  "durationMs",
  "productMatch",
  "apiStatus",
  "findingsCount",
]);
export function logEvent(
  event: string,
  fields: Record<string, string | number | boolean | null> = {},
): void {
  const safe: Record<string, string | number | boolean | null> = {};
  for (const [key, value] of Object.entries(fields)) {
    if (!ALLOWED_FIELDS.has(key)) continue;
    safe[key] = typeof value === "string" && value.includes("@")
      ? value.replace(/([^\s@])[^\s@]*@([^\s@]+)/g, "$1***@$2")
      : value;
  }
  // Call sites supply fixed event names and enum/numeric fields only.
  console.log(JSON.stringify({ event, ...safe }));
}
