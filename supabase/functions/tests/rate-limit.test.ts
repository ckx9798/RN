import { assertEquals } from "@std/assert";
import { createRateLimiter } from "../_shared/http/rate-limit.ts";

Deno.test("limiter: 20 per user per minute, denied calls do not extend window", () => {
  let time = 0;
  const limiter = createRateLimiter({
    limit: 20,
    windowMs: 60000,
    now: () => time,
  });
  for (let i = 0; i < 20; i++) assertEquals(limiter.take("A"), true);
  assertEquals(limiter.take("A"), false);
  assertEquals(limiter.take("B"), true);
  time = 59999;
  assertEquals(limiter.take("A"), false);
  time = 60000;
  assertEquals(limiter.take("A"), true);
});
