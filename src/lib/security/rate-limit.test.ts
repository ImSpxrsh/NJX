import { describe, expect, it } from "vitest";
import { FixedWindowRateLimiter, rateLimitKey } from "./rate-limit";

describe("FixedWindowRateLimiter", () => {
  it("allows up to the limit then blocks within a window", () => {
    const now = 1_000;
    const limiter = new FixedWindowRateLimiter(2, 1_000, () => now);
    expect(limiter.check("k").allowed).toBe(true);
    expect(limiter.check("k").allowed).toBe(true);
    const blocked = limiter.check("k");
    expect(blocked.allowed).toBe(false);
    expect(blocked.retryAfterMs).toBeGreaterThan(0);
  });

  it("resets after the window elapses", () => {
    let now = 0;
    const limiter = new FixedWindowRateLimiter(1, 1_000, () => now);
    expect(limiter.check("k").allowed).toBe(true);
    expect(limiter.check("k").allowed).toBe(false);
    now = 1_001;
    expect(limiter.check("k").allowed).toBe(true);
  });

  it("isolates keys", () => {
    const limiter = new FixedWindowRateLimiter(1, 1_000, () => 0);
    expect(limiter.check("a").allowed).toBe(true);
    expect(limiter.check("b").allowed).toBe(true);
  });

  it("hashes factors so raw values never appear in keys", () => {
    const key = rateLimitKey("scope", "203.0.113.7");
    expect(key).not.toContain("203.0.113.7");
    expect(key.startsWith("scope:")).toBe(true);
  });
});
