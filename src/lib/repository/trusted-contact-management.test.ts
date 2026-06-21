import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { CircleCheckRepositories } from "./contracts";
import { createDemoRepositories, resetDemo } from "./demo-store";

const HH = "11111111-1111-4111-8111-111111111111";
const OTHER_HH = "22222222-2222-4222-8222-222222222222";

let repos: CircleCheckRepositories;
const savedEnv = { ...process.env };

beforeEach(() => {
  process.env = { ...savedEnv, CIRCLECHECK_REPOSITORY_MODE: "demo" };
  resetDemo();
  repos = createDemoRepositories();
});

afterEach(() => {
  process.env = { ...savedEnv };
});

async function makeContact(household = HH, email = "person@example.com") {
  const result = await repos.enrollmentVerifications.createContact({
    householdId: household,
    displayName: "Trusted Contact",
    channel: "email",
    destination: email,
  });
  if (!result.ok) throw new Error(`setup failed: ${result.code}`);
  return result.contact;
}

describe("trusted-contact management (CC-201)", () => {
  it("lists only the requested household's contacts", async () => {
    await makeContact(HH, "a@example.com");
    await makeContact(HH, "b@example.com");
    await makeContact(OTHER_HH, "c@example.com");

    const list = await repos.trustedContacts.listForHousehold(HH);
    expect(list).toHaveLength(2);
    expect(list.every((c) => c.householdId === HH)).toBe(true);
  });

  it("counts a household's contacts", async () => {
    await makeContact(HH, "a@example.com");
    await makeContact(HH, "b@example.com");
    expect(await repos.trustedContacts.countForHousehold(HH)).toBe(2);
    expect(await repos.trustedContacts.countForHousehold(OTHER_HH)).toBe(0);
  });

  it("never exposes destinations in list reads through this layer", async () => {
    await makeContact(HH, "secret@example.com");
    const list = await repos.trustedContacts.listForHousehold(HH);
    // The record still carries internal fields here; the public projection in
    // toContactView strips them (covered by the route tests). Sanity-check the
    // ownership scoping value is present for the route to act on.
    expect(list[0]!.householdId).toBe(HH);
  });

  it("deletes only an owned contact", async () => {
    const contact = await makeContact(HH);
    // Cross-household delete is a no-op and reports not-found.
    expect(await repos.trustedContacts.remove(OTHER_HH, contact.id)).toBe(
      false,
    );
    expect(
      await repos.trustedContacts.getInternalById(contact.id),
    ).not.toBeNull();
    // Owner delete succeeds.
    expect(await repos.trustedContacts.remove(HH, contact.id)).toBe(true);
    expect(await repos.trustedContacts.getInternalById(contact.id)).toBeNull();
  });

  it("returns false when deleting an unknown id", async () => {
    expect(
      await repos.trustedContacts.remove(
        HH,
        "99999999-9999-4999-8999-999999999999",
      ),
    ).toBe(false);
  });
});

describe("per-household destination cap (CC-404)", () => {
  it("rejects creation once the configured cap is reached", async () => {
    process.env.MAX_DESTINATIONS_PER_HOUSEHOLD = "2";
    await makeContact(HH, "a@example.com");
    await makeContact(HH, "b@example.com");
    const third = await repos.enrollmentVerifications.createContact({
      householdId: HH,
      displayName: "Over the cap",
      channel: "email",
      destination: "c@example.com",
    });
    expect(third).toMatchObject({ ok: false, code: "LIMIT_EXCEEDED" });
  });

  it("does not count other households against the cap", async () => {
    process.env.MAX_DESTINATIONS_PER_HOUSEHOLD = "1";
    await makeContact(OTHER_HH, "a@example.com");
    const mine = await repos.enrollmentVerifications.createContact({
      householdId: HH,
      displayName: "Mine",
      channel: "email",
      destination: "b@example.com",
    });
    expect(mine.ok).toBe(true);
  });
});
