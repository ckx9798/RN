export function allowedWebOrigins(): string[] {
  return (Deno.env.get("ALLOWED_WEB_ORIGINS") ?? "").split(",").map((origin) =>
    origin.trim()
  ).filter(Boolean);
}
export function corsHeaders(req: Request, origins: string[]): Headers {
  const headers = new Headers({
    "Vary": "Origin",
    "Access-Control-Allow-Headers":
      "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
  });
  const origin = req.headers.get("origin");
  if (origin && origins.includes(origin)) {
    headers.set("Access-Control-Allow-Origin", origin);
  }
  return headers;
}
