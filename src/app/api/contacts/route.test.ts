import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { resetDemo } from "@/lib/repository/demo-store";
import { resetRepositoryFactoryForTests } from "@/lib/repository/factory";
import { GET, POST } from "./route";

beforeAll(() => {
  process.env.CIRCLECHECK_REPOSITORY_MODE = "demo";
});

beforeEach(() => {
  resetRepositoryFactoryForTests();
  resetDemo();
});

function postRequest(body: unknown) {
  return new Request("http://localhost/api/contacts", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/contacts", () => {
  it("creates an unverified destination from the authenticated household", async () => {
    const res = await POST(
      postRequest({ displayName: "Alex", phone: "(609) 555-1212" }),
    );
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.phone).toBe("+16095551212");
    expect(body.verified).toBe(false);
    // Public response never leaks the household identifier.
    expect(body).not.toHaveProperty("householdId");
  });

  it("rejects a client-supplied household_id (no ownership override)", async () => {
    const res = await POST(
      postRequest({
        displayName: "Attacker",
        phone: "+15555555555",
        household_id: "victim-household",
      }),
    );
    expect(res.status).toBe(422);
  });

  it("rejects a client attempt to force verified state", async () => {
    const res = await POST(
      postRequest({ displayName: "A", phone: "+16095551212", verified: true }),
    );
    expect(res.status).toBe(422);
  });

  it("rejects a destination with no channel", async () => {
    const res = await POST(postRequest({ displayName: "A" }));
    expect(res.status).toBe(422);
  });

  it("sets no-store on responses", async () => {
    const res = await GET();
    expect(res.headers.get("Cache-Control")).toBe("no-store");
  });
});
