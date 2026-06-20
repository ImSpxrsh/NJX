import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { resetRuntimeConfigForTests } from "@/lib/runtime-config";
import { resetRepositoryFactoryForTests } from "@/lib/repository/factory";
import { resetDemo } from "@/lib/repository/demo-store";
import { resetRateLimitsForTests } from "@/lib/security/rate-limit";

// Run all route tests in demo mode — demo store works without external
// dependencies. The security invariant "production never exposes demoContactUrl"
// is proven by the strict Zod schema tested in analyze-response.test.ts.
beforeAll(() => {
  process.env.CIRCLECHECK_RUNTIME_MODE = "demo";
  process.env.CIRCLECHECK_REPOSITORY_MODE = "demo";
});

beforeEach(() => {
  resetRuntimeConfigForTests();
  resetRepositoryFactoryForTests();
  resetRateLimitsForTests();
  resetDemo();
});

afterEach(() => {
  resetRuntimeConfigForTests();
  resetRepositoryFactoryForTests();
  resetRateLimitsForTests();
  vi.restoreAllMocks();
});

function makeRequest(body: unknown, url = "http://localhost:3000/api/analyze") {
  return new Request(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

const DEMO_HOUSEHOLD = "00000000-0000-4000-8000-000000000001";

// Import the route handler once. Runtime config and repository factory are
// reset between tests via their exported reset functions.
import { POST } from "./route";

describe("POST /api/analyze — input validation", () => {
  it("returns 400 for invalid householdId", async () => {
    const res = await POST(makeRequest({ householdId: "not-a-uuid", message: "hi" }));
    expect(res.status).toBe(400);
  });

  it("body field demo:true is rejected by strict input schema", async () => {
    const res = await POST(
      new Request("http://localhost:3000/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          householdId: DEMO_HOUSEHOLD,
          message: "send gift cards",
          demo: true,
        }),
      }),
    );
    expect(res.status).toBe(400);
  });

  it("returns 400 for empty body", async () => {
    const res = await POST(
      new Request("http://localhost:3000/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "not json",
      }),
    );
    expect(res.status).toBe(400);
  });
});

describe("POST /api/analyze — demo mode response shape", () => {
  it("contains expected safe base fields for any message", async () => {
    const res = await POST(
      makeRequest({ householdId: DEMO_HOUSEHOLD, message: "Hi, just checking in." }),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty("checkId");
    expect(body).toHaveProperty("state");
    expect(body).toHaveProperty("extraction");
    expect(body).toHaveProperty("decision");
    expect(body.checkId).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
    );
  });

  it("Cache-Control is no-store", async () => {
    const res = await POST(
      makeRequest({ householdId: DEMO_HOUSEHOLD, message: "test" }),
    );
    expect(res.headers.get("Cache-Control")).toBe("no-store");
  });

  it("high-risk message returns demoContactUrl inside verification", async () => {
    const res = await POST(
      makeRequest({
        householdId: DEMO_HOUSEHOLD,
        message:
          "Mom it's me, I need you to send $500 in gift cards RIGHT NOW. Don't tell anyone!",
      }),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    // demoContactUrl must be nested inside verification, never at top-level
    expect(body.verification).toHaveProperty("demoContactUrl");
    expect(body.verification.demoContactUrl).toMatch(/^https?:\/\/.+\/verify\//);
    expect(body).not.toHaveProperty("demoContactUrl");
  });

  it("high-risk response contains no raw token at any level", async () => {
    const res = await POST(
      makeRequest({
        householdId: DEMO_HOUSEHOLD,
        message:
          "Mom it's me, I'm in trouble, I need you to send $500 gift cards RIGHT NOW, don't tell anyone!",
      }),
    );
    const body = await res.json();
    const serialized = JSON.stringify(body);
    expect(serialized).not.toContain("rawToken");
    expect(serialized).not.toContain("tokenHash");
    expect(serialized).not.toContain("safePhrase");
    if (body.verification) {
      expect(body.verification).not.toHaveProperty("rawToken");
      expect(body.verification).not.toHaveProperty("token");
    }
  });

  it("low-risk message never returns demoContactUrl", async () => {
    const res = await POST(
      makeRequest({ householdId: DEMO_HOUSEHOLD, message: "Hi, just checking in." }),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).not.toHaveProperty("demoContactUrl");
    expect(body.verification?.demoContactUrl).toBeUndefined();
  });

  it("query param ?demo=true has no effect on demo mode activation", async () => {
    const res = await POST(
      makeRequest(
        { householdId: DEMO_HOUSEHOLD, message: "Hi, just checking in." },
        "http://localhost:3000/api/analyze?demo=true",
      ),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    // Low-risk: still no demoContactUrl regardless of query params
    expect(body).not.toHaveProperty("demoContactUrl");
    expect(body.verification?.demoContactUrl).toBeUndefined();
  });
});
