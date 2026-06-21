import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  getRepositories,
  resetRepositoryFactoryForTests,
} from "@/lib/repository/factory";
import { resetDemo } from "@/lib/repository/demo-store";
import { DELETE, GET } from "./route";

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

async function seed(household = HH) {
  const result = await getRepositories().enrollmentVerifications.createContact({
    householdId: household,
    displayName: "Trusted Contact",
    channel: "email",
    destination: "person@example.com",
  });
  if (!result.ok) throw new Error("setup failed");
  return result.contact.id;
}

function ctx(id: string) {
  return { params: Promise.resolve({ id }) };
}

function url(id: string, householdId: string) {
  return new Request(
    `http://localhost/api/enrollment/contacts/${id}?householdId=${householdId}`,
  );
}

describe("GET /api/enrollment/contacts/:id", () => {
  it("returns an owned contact without the destination", async () => {
    const id = await seed();
    const res = await GET(url(id, HH), ctx(id));
    expect(res.status).toBe(200);
    const raw = await res.clone().text();
    expect(JSON.parse(raw).contactId).toBe(id);
    expect(raw).not.toContain("person@example.com");
  });

  it("returns 404 for a cross-household read", async () => {
    const id = await seed();
    const res = await GET(url(id, OTHER_HH), ctx(id));
    expect(res.status).toBe(404);
  });
});

describe("DELETE /api/enrollment/contacts/:id", () => {
  it("deletes an owned contact", async () => {
    const id = await seed();
    const res = await DELETE(url(id, HH), ctx(id));
    expect(res.status).toBe(200);
    expect(
      await getRepositories().trustedContacts.getInternalById(id),
    ).toBeNull();
  });

  it("rejects a cross-household delete and leaves the contact intact", async () => {
    const id = await seed();
    const res = await DELETE(url(id, OTHER_HH), ctx(id));
    expect(res.status).toBe(404);
    expect(
      await getRepositories().trustedContacts.getInternalById(id),
    ).not.toBeNull();
  });
});
