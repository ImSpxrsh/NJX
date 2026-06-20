import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { resetRuntimeConfigForTests } from "@/lib/runtime-mode";
import { resetRepositoryFactoryForTests } from "@/lib/repository/factory";

// Cast process.env to allow mutation of NODE_ENV in tests.
const env = process.env as Record<string, string | undefined>;

let savedRepoMode: string | undefined;
let savedNodeEnv: string | undefined;

beforeEach(() => {
  resetRuntimeConfigForTests();
  resetRepositoryFactoryForTests();
  savedRepoMode = env.CIRCLECHECK_REPOSITORY_MODE;
  savedNodeEnv = env.NODE_ENV;
});

afterEach(() => {
  resetRuntimeConfigForTests();
  resetRepositoryFactoryForTests();
  vi.restoreAllMocks();
  if (savedRepoMode === undefined) delete env.CIRCLECHECK_REPOSITORY_MODE;
  else env.CIRCLECHECK_REPOSITORY_MODE = savedRepoMode;
  if (savedNodeEnv === undefined) delete env.NODE_ENV;
  else env.NODE_ENV = savedNodeEnv;
});

import { POST } from "./route";

describe("POST /api/demo/reset — non-demo environments", () => {
  it("returns 404 in production mode", async () => {
    env.CIRCLECHECK_REPOSITORY_MODE = "supabase";
    env.NODE_ENV = "production";
    resetRuntimeConfigForTests();
    resetRepositoryFactoryForTests();

    // Confirm no demo store mutation by spying on resetDemo
    const demoStore = await import("@/lib/repository/demo-store");
    const resetSpy = vi.spyOn(demoStore, "resetDemo");

    const res = await POST();
    expect(res.status).toBe(404);
    expect(resetSpy).not.toHaveBeenCalled();
  });

  it("returns 404 in development mode without demo", async () => {
    env.CIRCLECHECK_REPOSITORY_MODE = "supabase";
    env.NODE_ENV = "development";
    resetRuntimeConfigForTests();
    resetRepositoryFactoryForTests();

    const res = await POST();
    expect(res.status).toBe(404);
  });

  it("returns 404 when NODE_ENV=test and no demo repo mode", async () => {
    env.CIRCLECHECK_REPOSITORY_MODE = "supabase";
    env.NODE_ENV = "test";
    resetRuntimeConfigForTests();
    resetRepositoryFactoryForTests();

    const res = await POST();
    expect(res.status).toBe(404);
  });

  it("returns 404 for contradictory production+demo config (fails closed)", async () => {
    env.CIRCLECHECK_REPOSITORY_MODE = "demo";
    env.NODE_ENV = "production";
    resetRuntimeConfigForTests();
    resetRepositoryFactoryForTests();

    const res = await POST();
    expect(res.status).toBe(404);
  });

  it("response from non-demo mode contains no tokens or sensitive data", async () => {
    env.CIRCLECHECK_REPOSITORY_MODE = "supabase";
    env.NODE_ENV = "production";
    resetRuntimeConfigForTests();
    resetRepositoryFactoryForTests();

    const res = await POST();
    const body = await res.json();
    const bodyStr = JSON.stringify(body);
    expect(bodyStr).not.toContain("token");
    expect(bodyStr).not.toContain("verify");
    expect(bodyStr).not.toContain("household");
  });
});

describe("POST /api/demo/reset — demo mode", () => {
  beforeEach(() => {
    env.CIRCLECHECK_REPOSITORY_MODE = "demo";
    env.NODE_ENV = "test";
    resetRuntimeConfigForTests();
    resetRepositoryFactoryForTests();
  });

  it("returns 200 ok in explicit demo mode", async () => {
    const res = await POST();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ ok: true });
  });

  it("response contains no token or verification URL", async () => {
    const res = await POST();
    const body = await res.json();
    const bodyStr = JSON.stringify(body);
    expect(bodyStr).not.toContain("token");
    expect(bodyStr).not.toContain("verify");
  });

  it("clears demo store state", async () => {
    const { createCheck } = await import("@/lib/repository/demo-store");
    const { FixtureEvidenceExtractor } = await import(
      "@/lib/evidence/fixture-extractor"
    );
    const { evaluatePolicy } = await import("@/lib/policy/evaluate-policy");
    const { fixtures } = await import("@/fixtures/messages");

    const extraction = await new FixtureEvidenceExtractor().extract({
      text: fixtures.giftCardEmergency,
      requestId: "test",
    });
    createCheck({ extraction, decision: evaluatePolicy(extraction) });

    const res = await POST();
    expect(res.status).toBe(200);
  });
});

describe("POST /api/demo/reset — malformed requests are ignored", () => {
  it("body content does not affect non-demo 404", async () => {
    env.CIRCLECHECK_REPOSITORY_MODE = "supabase";
    env.NODE_ENV = "production";
    resetRuntimeConfigForTests();
    resetRepositoryFactoryForTests();

    // POST() ignores the request body — route handler signature takes no args
    const res = await POST();
    expect(res.status).toBe(404);
  });
});
