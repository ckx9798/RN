import { assert, assertEquals } from "@std/assert";
import { requireUser } from "../_shared/http/auth.ts";

Deno.test("auth: absent or malformed bearer rejected before network", async () => {
  for (const value of [null, "Basic abc", "Bearer ", "Bearer token extra"]) {
    const headers = new Headers();
    if (value) headers.set("authorization", value);
    assertEquals(
      await requireUser(new Request("https://edge.example", { headers }), {
        supabaseUrl: "https://db.example",
        anonKey: "anon",
        fetcher: () => {
          throw new Error("must not fetch");
        },
      }),
      null,
    );
  }
});
Deno.test("auth: verifies token with Auth server, returns user-scoped RLS client", async () => {
  let calls = 0;
  const user = await requireUser(
    new Request("https://edge.example", {
      headers: { authorization: "Bearer valid-token" },
    }),
    {
      supabaseUrl: "https://db.example",
      anonKey: "anon",
      fetcher: (input, init) => {
        assertEquals(
          new Headers(init?.headers).get("authorization"),
          "Bearer valid-token",
        );
        calls++;
        if (String(input).endsWith("/auth/v1/user")) {
          return Promise.resolve(
            Response.json({
              id: "verified-user",
              aud: "authenticated",
              role: "authenticated",
              email: "private@example.com",
            }),
          );
        }
        return Promise.resolve(Response.json([]));
      },
    },
  );
  assert(user);
  assertEquals(user.userId, "verified-user");
  await user.client.from("profiles").select("user_id");
  assertEquals(calls, 2);
});
Deno.test("auth: invalid token never becomes authenticated user", async () => {
  assertEquals(
    await requireUser(
      new Request("https://edge.example", {
        headers: { authorization: "Bearer bad-token" },
      }),
      {
        supabaseUrl: "https://db.example",
        anonKey: "anon",
        fetcher: () =>
          Promise.resolve(
            Response.json({ message: "invalid JWT" }, { status: 401 }),
          ),
      },
    ),
    null,
  );
});
