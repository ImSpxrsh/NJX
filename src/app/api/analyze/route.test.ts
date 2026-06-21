import {
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import { resetRuntimeConfigForTests } from "@/lib/runtime-config";
import { resetRepositoryFactoryForTests } from "@/lib/repository/factory";
import { resetDemo } from "@/lib/repository/demo-store";
import { resetRateLimitsForTests } from "@/lib/security/rate-limit";

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

import { POST } from "./route";

describe("POST /api/analyze — input validation", () => {
  it("returns 400 for an invalid householdId", async () => {
    const response = await POST(
      makeRequest({ householdId: "not-a-uuid", message: "hi" }),
    );
    expect(response.status).toBe(400);
  });

  it("rejects client-supplied mode controls", async () => {
    const response = await POST(
      makeRequest({
        householdId: DEMO_HOUSEHOLD,
        message: "send gift cards",
        demo: true,
      }),
    );
    expect(response.status).toBe(400);
  });

  it("returns 400 for malformed JSON", async () => {
    const response = await POST(
      new Request("http://localhost:3000/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "not json",
      }),
    );
    expect(response.status).toBe(400);
  });
});

describe("POST /api/analyze — demo response", () => {
  it("contains the expected safe fields", async () => {
    const response = await POST(
      makeRequest({
        householdId: DEMO_HOUSEHOLD,
        message: "Hi, just checking in.",
      }),
    );
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body).toHaveProperty("checkId");
    expect(body).toHaveProperty("state");
    expect(body).toHaveProperty("extraction");
    expect(body).toHaveProperty("decision");
    expect(body.checkId).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
    );
  });

  it("sets Cache-Control to no-store", async () => {
    const response = await POST(
      makeRequest({ householdId: DEMO_HOUSEHOLD, message: "test" }),
    );
    expect(response.headers.get("Cache-Control")).toBe("no-store");
  });

  it("returns the demo contact URL only inside verification", async () => {
    const response = await POST(
      makeRequest({
        householdId: DEMO_HOUSEHOLD,
        message:
          "Mom it's me, I need you to send $500 in gift cards RIGHT NOW. Don't tell anyone!",
      }),
    );
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.verification).toHaveProperty("demoContactUrl");
    expect(body.verification.demoContactUrl).toMatch(
      /^https?:\/\/.+\/verify\//,
    );
    expect(body).not.toHaveProperty("demoContactUrl");
  });

  it("never returns raw verification secrets", async () => {
    const response = await POST(
      makeRequest({
        householdId: DEMO_HOUSEHOLD,
        message:
          "Mom it's me, I'm in trouble, send $500 gift cards RIGHT NOW and don't tell anyone!",
      }),
    );
    const body = await response.json();
    const serialized = JSON.stringify(body);
    expect(serialized).not.toContain("rawToken");
    expect(serialized).not.toContain("tokenHash");
    expect(serialized).not.toContain("safePhrase");
  });

  it("does not return a demo contact URL for low-risk messages", async () => {
    const response = await POST(
      makeRequest({
        householdId: DEMO_HOUSEHOLD,
        message: "Hi, just checking in.",
      }),
    );
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body).not.toHaveProperty("demoContactUrl");
    expect(body.verification?.demoContactUrl).toBeUndefined();
  });

  it("does not derive demo mode from query parameters", async () => {
    const response = await POST(
      makeRequest(
        { householdId: DEMO_HOUSEHOLD, message: "Hi, just checking in." },
        "http://localhost:3000/api/analyze?demo=true",
      ),
    );
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.verification?.demoContactUrl).toBeUndefined();
  });
});
