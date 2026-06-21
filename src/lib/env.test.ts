import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

describe("env validation", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.resetModules();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it("accepts demo mode without Supabase credentials", async () => {
    process.env.CIRCLECHECK_REPOSITORY_MODE = "demo";
    delete process.env.SUPABASE_URL;
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;

    const { env } = await import("@/lib/env");
    expect(env.CIRCLECHECK_REPOSITORY_MODE).toBe("demo");
  });

  it("accepts supabase mode with required credentials", async () => {
    process.env.CIRCLECHECK_REPOSITORY_MODE = "supabase";
    process.env.SUPABASE_URL = "https://example.supabase.co";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "secret-key";

    const { env } = await import("@/lib/env");
    expect(env.CIRCLECHECK_REPOSITORY_MODE).toBe("supabase");
  });

  it("throws when supabase mode is missing SUPABASE_URL", async () => {
    process.env.CIRCLECHECK_REPOSITORY_MODE = "supabase";
    delete process.env.SUPABASE_URL;
    process.env.SUPABASE_SERVICE_ROLE_KEY = "secret-key";

    await expect(import("@/lib/env")).rejects.toThrow(
      "SUPABASE_URL required when CIRCLECHECK_REPOSITORY_MODE=supabase",
    );
  });

  it("throws when supabase mode is missing SUPABASE_SERVICE_ROLE_KEY", async () => {
    process.env.CIRCLECHECK_REPOSITORY_MODE = "supabase";
    process.env.SUPABASE_URL = "https://example.supabase.co";
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;

    await expect(import("@/lib/env")).rejects.toThrow(
      "SUPABASE_SERVICE_ROLE_KEY required when CIRCLECHECK_REPOSITORY_MODE=supabase",
    );
  });

  it("throws when CIRCLECHECK_REPOSITORY_MODE is invalid", async () => {
    process.env.CIRCLECHECK_REPOSITORY_MODE = "invalid-mode";

    await expect(import("@/lib/env")).rejects.toThrow(
      "[env] Invalid environment configuration",
    );
  });

  it("throws when CIRCLECHECK_REPOSITORY_MODE is missing", async () => {
    delete process.env.CIRCLECHECK_REPOSITORY_MODE;

    await expect(import("@/lib/env")).rejects.toThrow(
      "[env] Invalid environment configuration",
    );
  });

  it("throws when NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY is set", async () => {
    process.env.CIRCLECHECK_REPOSITORY_MODE = "demo";
    process.env.NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY = "leaked-key";

    await expect(import("@/lib/env")).rejects.toThrow(
      "NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY must never be set",
    );
  });

  it("applies default values for optional config", async () => {
    process.env.CIRCLECHECK_REPOSITORY_MODE = "demo";
    delete process.env.VERIFICATION_TOKEN_TTL_MINUTES;
    delete process.env.EVIDENCE_EXTRACTOR_MODE;

    const { env } = await import("@/lib/env");
    expect(env.VERIFICATION_TOKEN_TTL_MINUTES).toBe(10);
    expect(env.EVIDENCE_EXTRACTOR_MODE).toBe("fixture");
  });

  it("parses env vars at import time (module-level execution)", async () => {
    process.env.CIRCLECHECK_REPOSITORY_MODE = "demo";

    // Import the module — if parseEnv() runs at load time, env should be ready immediately
    const mod = await import("@/lib/env");
    expect(mod.env).toBeDefined();
    expect(mod.env.CIRCLECHECK_REPOSITORY_MODE).toBe("demo");
  });
});
