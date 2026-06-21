import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  getRepositories,
  resetRepositoryFactoryForTests,
} from "@/lib/repository/factory";
import { resetDemo } from "@/lib/repository/demo-store";
import { POST } from "./route";

const HH = "33333333-3333-4333-8333-333333333333";
const OTHER_HH = "44444444-4444-4444-8444-444444444444";
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

async function seedSms(household = HH) {
  const result = await getRepositories().enrollmentVerifications.createContact({
    householdId: household,
    displayName: "Trusted Contact",
    channel: "sms",
    destination: "+16095551212",
  });
  if (!result.ok) throw new Error("setup failed");
  return result.contact.id;
}

// Drive the real verification flow so the destination becomes verified.
async function verify(contactId: string, household = HH) {
  const repo = getRepositories().enrollmentVerifications;
  const start = await repo.start({
    householdId: household,
    trustedContactId: contactId,
  });
  if (!start.ok || start.deliverySecret.kind !== "code") {
    throw new Error("start failed");
  }
  const confirmed = await repo.confirmByCode(
    contactId,
    start.deliverySecret.code,
  );
  if (!confirmed.ok) throw new Error("confirm failed");
}

function ctx(id: string) {
  return { params: Promise.resolve({ id }) };
}

function request(householdId: string, id: string) {
  return new Request(
    `http://localhost/api/enrollment/contacts/${id}/high-trust`,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ householdId }),
    },
  );
}

describe("POST /api/enrollment/contacts/:id/high-trust", () => {
  it("blocks an unverified destination (403)", async () => {
    const id = await seedSms();
    const res = await POST(request(HH, id), ctx(id));
    expect(res.status).toBe(403);
  });

  it("allows a verified destination", async () => {
    const id = await seedSms();
    await verify(id);
    const res = await POST(request(HH, id), ctx(id));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.eligible).toBe(true);
    expect(body.contact.destinationVerified).toBe(true);
  });

  it("returns 404 for a cross-household request", async () => {
    const id = await seedSms();
    await verify(id);
    const res = await POST(request(OTHER_HH, id), ctx(id));
    expect(res.status).toBe(404);
  });
});
