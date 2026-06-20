import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  getRepositories,
  resetRepositoryFactoryForTests,
} from "@/lib/repository/factory";
import { resetDemo } from "@/lib/repository/demo-store";
import { POST } from "./route";

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

async function makeContact(channel: "sms" | "email", destination: string) {
  const result = await getRepositories().enrollmentVerifications.createContact({
    householdId: HH,
    displayName: "Trusted Contact",
    channel,
    destination,
  });
  if (!result.ok) throw new Error("setup failed");
  return result.contact.id;
}

function startRequest(trustedContactId: string) {
  return new Request("http://localhost/api/enrollment/verify/start", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ householdId: HH, trustedContactId }),
  });
}

describe("POST /api/enrollment/verify/start", () => {
  it("never returns the secret when demo mode is off (the default)", async () => {
    const contactId = await makeContact("email", "person@example.com");
    const response = await POST(startRequest(contactId));
    const raw = await response.clone().text();
    const body = JSON.parse(raw);

    expect(body.demoMode).toBe(false);
    expect(body.demo).toBeUndefined();
    expect(raw).not.toContain("/enroll/verify/");
  });

  it("surfaces the secret only when demo mode is explicitly enabled", async () => {
    process.env.ENROLLMENT_DEMO_MODE = "on";
    const contactId = await makeContact("email", "person@example.com");
    const response = await POST(startRequest(contactId));
    const body = await response.json();

    expect(body.demoMode).toBe(true);
    expect(body.demo.notice).toContain("DEMO MODE");
    expect(body.demo.verifyUrl).toContain("/enroll/verify/");
  });

  it("rejects an unknown contact with a generic error", async () => {
    const response = await POST(
      startRequest("44444444-4444-4444-8444-444444444444"),
    );
    expect(response.status).toBe(400);
  });
});
