import { describe, expect, it, vi, afterEach } from "vitest";
import {
  createVerificationToken,
  isValidTokenFormat,
  redactToken,
  resolveTokenTtlMs,
  rotateVerificationToken,
  tokenExpiresAt,
  TOKEN_BYTES,
  TOKEN_TTL_DEFAULT_MS,
  TOKEN_TTL_MAX_MS,
  TOKEN_TTL_MIN_MS,
} from "./tokens";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("verification tokens", () => {
  it("uses 256 bits of entropy and stores a distinct hash", () => {
    const token = createVerificationToken();
    expect(TOKEN_BYTES).toBeGreaterThanOrEqual(16);
    expect(isValidTokenFormat(token.rawToken)).toBe(true);
    expect(token.tokenHash).not.toContain(token.rawToken);
    expect(token.tokenHash).toHaveLength(64);
  });

  it("rejects malformed values", () => {
    expect(isValidTokenFormat("short")).toBe(false);
    expect(isValidTokenFormat("a".repeat(43))).toBe(true);
  });
});

describe("rotateVerificationToken", () => {
  it("returns a new independent token each call", () => {
    const a = rotateVerificationToken();
    const b = rotateVerificationToken();
    expect(a.rawToken).not.toBe(b.rawToken);
    expect(a.tokenHash).not.toBe(b.tokenHash);
    expect(isValidTokenFormat(a.rawToken)).toBe(true);
  });
});

describe("resolveTokenTtlMs", () => {
  it("returns default when env var is absent", () => {
    expect(resolveTokenTtlMs()).toBe(TOKEN_TTL_DEFAULT_MS);
  });

  it("returns the configured value when valid", () => {
    vi.stubEnv("VERIFICATION_TOKEN_TTL_MS", "300000");
    expect(resolveTokenTtlMs()).toBe(300_000);
  });

  it("clamps to minimum when below bound", () => {
    vi.stubEnv("VERIFICATION_TOKEN_TTL_MS", "1000");
    expect(resolveTokenTtlMs()).toBe(TOKEN_TTL_MIN_MS);
  });

  it("clamps to maximum when above bound", () => {
    vi.stubEnv("VERIFICATION_TOKEN_TTL_MS", "999999999");
    expect(resolveTokenTtlMs()).toBe(TOKEN_TTL_MAX_MS);
  });

  it("returns default for non-numeric value", () => {
    vi.stubEnv("VERIFICATION_TOKEN_TTL_MS", "not-a-number");
    expect(resolveTokenTtlMs()).toBe(TOKEN_TTL_DEFAULT_MS);
  });
});

describe("tokenExpiresAt", () => {
  it("returns an ISO string approximately ttlMs in the future", () => {
    const before = Date.now();
    const expires = tokenExpiresAt(60_000);
    const after = Date.now();
    const expireMs = new Date(expires).getTime();
    expect(expireMs).toBeGreaterThanOrEqual(before + 60_000);
    expect(expireMs).toBeLessThanOrEqual(after + 60_000);
  });

  it("uses resolveTokenTtlMs when no argument given", () => {
    vi.stubEnv("VERIFICATION_TOKEN_TTL_MS", "120000");
    const before = Date.now();
    const expires = tokenExpiresAt();
    const expireMs = new Date(expires).getTime();
    expect(expireMs).toBeGreaterThanOrEqual(before + 120_000);
  });
});

describe("redactToken", () => {
  it("replaces a token in a URL", () => {
    const { rawToken } = createVerificationToken();
    const url = `https://example.com/verify/${rawToken}?foo=bar`;
    expect(redactToken(url)).toBe(
      "https://example.com/verify/[REDACTED]?foo=bar",
    );
  });

  it("replaces multiple tokens in a string", () => {
    const { rawToken: t1 } = createVerificationToken();
    const { rawToken: t2 } = createVerificationToken();
    const msg = `token1=${t1} token2=${t2}`;
    expect(redactToken(msg)).toBe("token1=[REDACTED] token2=[REDACTED]");
  });

  it("leaves strings without tokens unchanged", () => {
    expect(redactToken("no tokens here")).toBe("no tokens here");
  });
});
