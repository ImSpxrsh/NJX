import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { resetRuntimeConfigForTests } from "@/lib/runtime-config";
import { resetRepositoryFactoryForTests } from "@/lib/repository/factory";
import { resetRateLimitsForTests } from "@/lib/security/rate-limit";

// Cast process.env to allow mutation of env in tests.
const env = process.env as Record<string, string | undefined>;

let savedRuntimeMode: string | undefined;
let savedRepoMode: string | undefined;

beforeEach(() => {
  savedRuntimeMode = env.CIRCLECHECK_RUNTIME_MODE;
  savedRepoMode = env.CIRCLECHECK_REPOSITORY_MODE;
  resetRuntimeConfigForTests();
  resetRepositoryFactoryForTests();
  resetRateLimitsForTests();
});

afterEach(() => {
  resetRuntimeConfigForTests();
  resetRepositoryFactoryForTests();
  resetRateLimitsForTests();
  vi.restoreAllMocks();
  if (savedRuntimeMode === undefined) delete env.CIRCLECHECK_RUNTIME_MODE;
  else env.CIRCLECHECK_RUNTIME_MODE = savedRuntimeMode;
  if (savedRepoMode === undefined) delete env.CIRCLECHECK_REPOSITORY_MODE;
  else env.CIRCLECHECK_REPOSITORY_MODE = savedRepoMode;
});

function demoResetRequest() {
  return new Request("http://localhost:3000/api/demo/reset", {
    method: "POST",
    headers: { origin: "http://localhost:3000" },
  });
}

function nonDemoRequest() {
  return new Request("http://localhost:3000/api/demo/reset", { method: "POST" });
}

import { POST } from "./route";

describe("POST /api/demo/reset — non-demo environments return 404", () => {
  it("returns 404 when CIRCLECHECK_RUNTIME_MODE is unset (test env default)", async () => {
    delete env.CIRCLECHECK_RUNTIME_MODE;
    env.CIRCLECHECK_REPOSITORY_MODE = "supabase";
    resetRuntimeConfigForTests();
    resetRepositoryFactoryForTests();

    const res = await POST(nonDemoRequest());
    expect(res.status).toBe(404);
  });

  it("returns 404 when CIRCLECHECK_RUNTIME_MODE=test", async () => {
    env.CIRCLECHECK_RUNTIME_MODE = "test";
    env.CIRCLECHECK_REPOSITORY_MODE = "supabase";
    resetRuntimeConfigForTests();
    resetRepositoryFactoryForTests();

    const res = await POST(nonDemoRequest());
    expect(res.status).toBe(404);
  });

  it("returns 404 when CIRCLECHECK_RUNTIME_MODE=development", async () => {
    env.CIRCLECHECK_RUNTIME_MODE = "development";
    env.CIRCLECHECK_REPOSITORY_MODE = "supabase";
    resetRuntimeConfigForTests();
    resetRepositoryFactoryForTests();

    const res = await POST(nonDemoRequest());
    expect(res.status).toBe(404);
  });

  it("non-demo 404 response contains no tokens or household data", async () => {
    delete env.CIRCLECHECK_RUNTIME_MODE;
    env.CIRCLECHECK_REPOSITORY_MODE = "supabase";
    resetRuntimeConfigForTests();
    resetRepositoryFactoryForTests();

    const res = await POST(nonDemoRequest());
    const body = await res.json();
    const bodyStr = JSON.stringify(body);
    expect(bodyStr).not.toContain("token");
    expect(bodyStr).not.toContain("verify");
    expect(bodyStr).not.toContain("household");
  });

  it("does not touch demo store in non-demo mode", async () => {
    delete env.CIRCLECHECK_RUNTIME_MODE;
    env.CIRCLECHECK_REPOSITORY_MODE = "supabase";
    resetRuntimeConfigForTests();
    resetRepositoryFactoryForTests();

    const demoStore = await import("@/lib/repository/demo-store");
    const resetSpy = vi.spyOn(demoStore, "resetDemo");

    await POST(nonDemoRequest());
    expect(resetSpy).not.toHaveBeenCalled();
  });
});

describe("POST /api/demo/reset — demo mode", () => {
  beforeEach(() => {
    env.CIRCLECHECK_RUNTIME_MODE = "demo";
    env.CIRCLECHECK_REPOSITORY_MODE = "demo";
    resetRuntimeConfigForTests();
    resetRepositoryFactoryForTests();
  });

  it("returns 200 ok with correct origin in demo mode", async () => {
    const res = await POST(demoResetRequest());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ ok: true });
  });

  it("returns 403 when origin header does not match publicAppUrl", async () => {
    const res = await POST(
      new Request("http://localhost:3000/api/demo/reset", {
        method: "POST",
        headers: { origin: "https://attacker.example.com" },
      }),
    );
    expect(res.status).toBe(403);
  });

  it("returns 403 when origin header is absent", async () => {
    const res = await POST(nonDemoRequest());
    expect(res.status).toBe(403);
  });

  it("reset response contains no token or verification URL", async () => {
    const res = await POST(demoResetRequest());
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

    const res = await POST(demoResetRequest());
    expect(res.status).toBe(200);
  });
});
