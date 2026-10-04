/** Isolate-local best effort: not a distributed production quota. */
export function createRateLimiter(
  opts: { limit: number; windowMs: number; now?: () => number },
): { take(key: string): boolean } {
  const now = opts.now ?? Date.now;
  const entries = new Map<string, { start: number; count: number }>();
  let sweptAt = now();
  return {
    take(key) {
      const time = now();
      if (time - sweptAt >= opts.windowMs) {
        for (
          const [id, entry] of entries
        ) if (time - entry.start >= opts.windowMs) entries.delete(id);
        sweptAt = time;
      }
      const entry = entries.get(key);
      if (!entry || time - entry.start >= opts.windowMs) {
        if (!entry && entries.size >= 10000) return false;
        entries.set(key, { start: time, count: 1 });
        return true;
      }
      if (entry.count >= opts.limit) return false;
      entry.count++;
      return true;
    },
  };
}
