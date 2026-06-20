import { describe, expect, it, beforeEach } from "vitest";
import { rateLimit, resetRateLimitsForTests } from "./rate-limit";

describe("rateLimit", () => {
  beforeEach(resetRateLimitsForTests);

  it("allows requests until the coarse bucket limit is reached", () => {
    expect(
      rateLimit({ name: "test", key: "client", limit: 2, windowMs: 60_000 }),
    ).toMatchObject({ allowed: true });
    expect(
      rateLimit({ name: "test", key: "client", limit: 2, windowMs: 60_000 }),
    ).toMatchObject({ allowed: true });
    expect(
      rateLimit({ name: "test", key: "client", limit: 2, windowMs: 60_000 }),
    ).toMatchObject({ allowed: false });
  });
});
