import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { resetRuntimeConfigForTests } from "@/lib/runtime-config";
import { resetRepositoryFactoryForTests } from "@/lib/repository/factory";
import { resetRateLimitsForTests } from "@/lib/security/rate-limit";

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

function demoResetRequest(origin = "http://localhost:3000") {
  return new Request("http://localhost:3000/api/demo/reset", {
    method: "POST",
    headers: { origin },
  });
}

function nonDemoRequest() {
  return new Request("http://localhost:3000/api/demo/reset", {
    method: "POST",
  });
}

import { POST } from "./route";

describe("POST /api/demo/reset — non-demo environments", () => {
  it.each([undefined, "test", "development"] as const)(
    "returns 404 when runtime mode is %s",
    async (runtimeMode) => {
      if (runtimeMode === undefined) delete env.CIRCLECHECK_RUNTIME_MODE;
      else env.CIRCLECHECK_RUNTIME_MODE = runtimeMode;
      env.CIRCLECHECK_REPOSITORY_MODE = "supabase";
      resetRuntimeConfigForTests();
      resetRepositoryFactoryForTests();

      const response = await POST(nonDemoRequest());
      expect(response.status).toBe(404);
    },
  );

  it("does not touch demo state outside demo mode", async () => {
    delete env.CIRCLECHECK_RUNTIME_MODE;
    env.CIRCLECHECK_REPOSITORY_MODE = "supabase";
    resetRuntimeConfigForTests();
    resetRepositoryFactoryForTests();
    const demoStore = await import("@/lib/repository/demo-store");
    const resetSpy = vi.spyOn(demoStore, "resetDemo");

    const response = await POST(nonDemoRequest());
    expect(response.status).toBe(404);
    expect(resetSpy).not.toHaveBeenCalled();
    expect(JSON.stringify(await response.json())).not.toMatch(
      /token|verify|household/i,
    );
  });
});

describe("POST /api/demo/reset — demo mode", () => {
  beforeEach(() => {
    env.CIRCLECHECK_RUNTIME_MODE = "demo";
    env.CIRCLECHECK_REPOSITORY_MODE = "demo";
    resetRuntimeConfigForTests();
    resetRepositoryFactoryForTests();
  });

  it("returns 200 for the configured origin", async () => {
    const response = await POST(demoResetRequest());
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true });
  });

  it("rejects an untrusted origin", async () => {
    const response = await POST(demoResetRequest("https://attacker.example"));
    expect(response.status).toBe(403);
  });

  it("rejects a missing origin", async () => {
    const response = await POST(nonDemoRequest());
    expect(response.status).toBe(403);
  });

  it("returns no token or verification URL", async () => {
    const response = await POST(demoResetRequest());
    expect(JSON.stringify(await response.json())).not.toMatch(/token|verify/i);
  });

  it("clears demo store state", async () => {
    const { createCheck } = await import("@/lib/repository/demo-store");
    const { FixtureEvidenceExtractor } =
      await import("@/lib/evidence/fixture-extractor");
    const { evaluatePolicy } = await import("@/lib/policy/evaluate-policy");
    const { fixtures } = await import("@/fixtures/messages");
    const extraction = await new FixtureEvidenceExtractor().extract({
      text: fixtures.giftCardEmergency,
      requestId: "test",
    });
    createCheck({ extraction, decision: evaluatePolicy(extraction) });

    const response = await POST(demoResetRequest());
    expect(response.status).toBe(200);
  });
});
