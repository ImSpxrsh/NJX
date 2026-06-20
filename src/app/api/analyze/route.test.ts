import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { resetRuntimeConfigForTests } from "@/lib/runtime-mode";
import { resetRepositoryFactoryForTests } from "@/lib/repository/factory";
import { resetDemo } from "@/lib/repository/demo-store";

// Cast process.env to allow mutation of NODE_ENV in tests.
const env = process.env as Record<string, string | undefined>;

// Recursive helper: assert no forbidden sensitive fields anywhere in the object.
const FORBIDDEN_KEYS = new Set([
  "token",
  "rawToken",
  "tokenHash",
  "secret",
  "safePhrase",
  "demoContactUrl",
  "verificationUrl",
  "verifyUrl",
  "contactUrl",
]);

function expectNoSensitiveFields(value: unknown, path = ""): void {
  if (!value || typeof value !== "object") return;
  for (const [key, nested] of Object.entries(value as Record<string, unknown>)) {
    const currentPath = path ? `${path}.${key}` : key;
    if (FORBIDDEN_KEYS.has(key)) {
      throw new Error(
        `Forbidden sensitive field found in production response: "${currentPath}"`,
      );
    }
    if (typeof nested === "string" && nested.includes("/verify/")) {
      throw new Error(
        `Production response contains a verification URL at "${currentPath}": ${nested}`,
      );
    }
    expectNoSensitiveFields(nested, currentPath);
  }
}

function expectNoTokenInUrl(value: unknown, path = ""): void {
  if (!value || typeof value !== "object") return;
  for (const [key, nested] of Object.entries(value as Record<string, unknown>)) {
    const currentPath = path ? `${path}.${key}` : key;
    if (
      typeof nested === "string" &&
      /\/verify\/[A-Za-z0-9_-]{30,}/.test(nested)
    ) {
      throw new Error(
        `Production response contains a token-bearing URL at "${currentPath}": ${nested}`,
      );
    }
    if (typeof nested === "object") {
      expectNoTokenInUrl(nested, currentPath);
    }
  }
}

function makeRequest(body: unknown, url = "http://localhost:3000/api/analyze") {
  return new Request(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

const DEMO_HOUSEHOLD = "00000000-0000-4000-8000-000000000001";

let savedRepoMode: string | undefined;
let savedNodeEnv: string | undefined;

beforeEach(() => {
  resetRuntimeConfigForTests();
  resetRepositoryFactoryForTests();
  resetDemo();
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

// Import the route handler once. Runtime config and repository factory are
// reset between tests via their exported reset functions so we don't need to
// re-import the module dynamically each time.
import { POST } from "./route";

describe("POST /api/analyze — production mode (contradictory config → fails closed)", () => {
  beforeEach(() => {
    // NODE_ENV=production + demo repo = contradictory → runtime resolves to production
    env.CIRCLECHECK_REPOSITORY_MODE = "demo";
    env.NODE_ENV = "production";
    resetRuntimeConfigForTests();
    resetRepositoryFactoryForTests();
  });

  it("returns 400 for invalid input", async () => {
    const res = await POST(makeRequest({ householdId: "not-a-uuid", message: "hi" }));
    expect(res.status).toBe(400);
  });

  it("never returns demoContactUrl for a low-risk message", async () => {
    const res = await POST(
      makeRequest({ householdId: DEMO_HOUSEHOLD, message: "Hi, just checking in." }),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expectNoSensitiveFields(body);
    expectNoTokenInUrl(body);
    expect(body).not.toHaveProperty("demoContactUrl");
  });

  it("never returns demoContactUrl for a high-risk message", async () => {
    const res = await POST(
      makeRequest({
        householdId: DEMO_HOUSEHOLD,
        message:
          "Mom it's me, I'm in trouble, I need you to send $500 gift cards RIGHT NOW, don't tell anyone!",
      }),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expectNoSensitiveFields(body);
    expectNoTokenInUrl(body);
    expect(body).not.toHaveProperty("demoContactUrl");
    if (body.verification) {
      expect(body.verification).not.toHaveProperty("rawToken");
      expect(body.verification).not.toHaveProperty("demoContactUrl");
      expect(body.verification).not.toHaveProperty("token");
    }
  });

  it("production response contains expected safe fields", async () => {
    const res = await POST(
      makeRequest({ householdId: DEMO_HOUSEHOLD, message: "Hi, just checking in." }),
    );
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
});

describe("POST /api/analyze — strict input: client-supplied extra fields rejected", () => {
  beforeEach(() => {
    env.CIRCLECHECK_REPOSITORY_MODE = "demo";
    env.NODE_ENV = "production";
    resetRuntimeConfigForTests();
    resetRepositoryFactoryForTests();
  });

  it("body field demo: true is rejected by strict input schema", async () => {
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
    // strict() on input schema rejects unknown keys
    expect(res.status).toBe(400);
  });

  it("query param ?demo=true has no effect on response", async () => {
    const res = await POST(
      makeRequest(
        { householdId: DEMO_HOUSEHOLD, message: "Hi, just checking in." },
        "http://localhost:3000/api/analyze?demo=true",
      ),
    );
    const body = await res.json();
    if (res.status === 200) {
      expectNoSensitiveFields(body);
      expect(body).not.toHaveProperty("demoContactUrl");
    }
  });
});

describe("POST /api/analyze — demo mode", () => {
  beforeEach(() => {
    env.CIRCLECHECK_REPOSITORY_MODE = "demo";
    env.NODE_ENV = "test";
    resetRuntimeConfigForTests();
    resetRepositoryFactoryForTests();
    resetDemo();
  });

  it("returns demoContactUrl for a high-risk message in demo mode", async () => {
    const res = await POST(
      makeRequest({
        householdId: DEMO_HOUSEHOLD,
        message:
          "Mom it's me, I need you to send $500 in gift cards RIGHT NOW. Don't tell anyone!",
      }),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty("demoContactUrl");
    expect(typeof body.demoContactUrl).toBe("string");
    expect(body.demoContactUrl).toContain("/verify/");
  });

  it("does not return demoContactUrl for low-risk messages (no verification needed)", async () => {
    const res = await POST(
      makeRequest({ householdId: DEMO_HOUSEHOLD, message: "Hi, just checking in." }),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).not.toHaveProperty("demoContactUrl");
  });

  it("demoContactUrl is at top level, not nested inside verification", async () => {
    const res = await POST(
      makeRequest({
        householdId: DEMO_HOUSEHOLD,
        message: "Mom, send gift cards RIGHT NOW, don't tell anyone!",
      }),
    );
    const body = await res.json();
    if (body.demoContactUrl) {
      // Must be top-level, not inside verification
      expect(body.verification?.demoContactUrl).toBeUndefined();
      expect(body.demoContactUrl).toMatch(/^https?:\/\//);
    }
  });
});
