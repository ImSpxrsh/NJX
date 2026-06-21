import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  getRepositories,
  resetRepositoryFactoryForTests,
} from "@/lib/repository/factory";
import { resetDemo } from "@/lib/repository/demo-store";
import { GET, POST } from "./route";

const HH = "33333333-3333-4333-8333-333333333333";
const savedEnv = { ...process.env };

beforeEach(() => {
  process.env = { ...savedEnv, CIRCLECHECK_REPOSITORY_MODE: "demo" };
  resetRepositoryFactoryForTests();
  resetDemo();
});

afterEach(() => {
  process.env = { ...savedEnv };
  resetRepositoryFactoryForTests();
});

async function seed(email: string) {
  const result = await getRepositories().enrollmentVerifications.createContact({
    householdId: HH,
    displayName: "Trusted Contact",
    channel: "email",
    destination: email,
  });
  if (!result.ok) throw new Error("setup failed");
  return result.contact.id;
}

function createRequest(body: unknown) {
  return new Request("http://localhost/api/enrollment/contacts", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("GET /api/enrollment/contacts", () => {
  it("lists the household's contacts without exposing destinations", async () => {
    await seed("a@example.com");
    await seed("b@example.com");
    const res = await GET(
      new Request(`http://localhost/api/enrollment/contacts?householdId=${HH}`),
    );
    expect(res.status).toBe(200);
    const raw = await res.clone().text();
    const body = JSON.parse(raw);
    expect(body.contacts).toHaveLength(2);
    expect(res.headers.get("Cache-Control")).toBe("no-store");
    // No raw destination, household id, or secret leaks.
    expect(raw).not.toContain("@example.com");
    expect(raw).not.toContain("householdId");
  });

  it("requires a valid householdId", async () => {
    const res = await GET(
      new Request("http://localhost/api/enrollment/contacts?householdId=nope"),
    );
    expect(res.status).toBe(400);
  });
});

describe("POST /api/enrollment/contacts destination cap", () => {
  it("returns 429 once the household reaches the cap", async () => {
    process.env.MAX_DESTINATIONS_PER_HOUSEHOLD = "1";
    resetRepositoryFactoryForTests();
    const first = await POST(
      createRequest({
        householdId: HH,
        displayName: "First",
        channel: "email",
        destination: "first@example.com",
      }),
    );
    expect(first.status).toBe(201);
    const second = await POST(
      createRequest({
        householdId: HH,
        displayName: "Second",
        channel: "email",
        destination: "second@example.com",
      }),
    );
    expect(second.status).toBe(429);
  });

  it("still rejects an invalid destination with 400", async () => {
    const res = await POST(
      createRequest({
        householdId: HH,
        displayName: "Bad",
        channel: "email",
        destination: "not-an-email",
      }),
    );
    expect(res.status).toBe(400);
  });
});
