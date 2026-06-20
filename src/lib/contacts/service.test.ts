import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { resetDemo } from "@/lib/repository/demo-store";
import {
  getRepositories,
  resetRepositoryFactoryForTests,
} from "@/lib/repository/factory";
import { resetRuntimeConfigForTests } from "@/lib/runtime-config";
import { ContactError } from "./errors";
import {
  assertHighTrustEligible,
  completeDestinationVerification,
  enrollContact,
  getContact,
  listContacts,
  removeContact,
  startDestinationVerification,
  updateContact,
} from "./service";

const HOUSEHOLD = "00000000-0000-4000-8000-000000000001";
const OTHER_HOUSEHOLD = "00000000-0000-4000-8000-0000000000ff";

beforeAll(() => {
  process.env.CIRCLECHECK_RUNTIME_MODE = "demo";
  process.env.CIRCLECHECK_REPOSITORY_MODE = "demo";
});

beforeEach(() => {
  resetRuntimeConfigForTests();
  resetRepositoryFactoryForTests();
  resetDemo();
});

async function enrollPhone(phone = "+16095551212") {
  return enrollContact(HOUSEHOLD, { displayName: "Alex", phone });
}

describe("enrollment", () => {
  it("creation never marks a destination verified", async () => {
    const contact = await enrollPhone();
    expect(contact.verified).toBe(false);
    expect(contact.verifiedAt).toBeNull();
    expect(contact.verifiedChannel).toBeNull();
  });

  it("normalizes and stores phone as E.164", async () => {
    const contact = await enrollContact(HOUSEHOLD, {
      displayName: "Alex",
      phone: "(609) 555-1212",
    });
    expect(contact.phone).toBe("+16095551212");
  });

  it("normalizes email", async () => {
    const contact = await enrollContact(HOUSEHOLD, {
      displayName: "Alex",
      email: "Test@Example.COM",
    });
    expect(contact.email).toBe("test@example.com");
  });

  it("rejects an invalid phone", async () => {
    await expect(
      enrollContact(HOUSEHOLD, {
        displayName: "A",
        phone: "609-555-1212 ext 4",
      }),
    ).rejects.toBeInstanceOf(ContactError);
  });

  it("rejects a payload with no channel", async () => {
    await expect(
      enrollContact(HOUSEHOLD, { displayName: "A" }),
    ).rejects.toMatchObject({ code: "VALIDATION" });
  });

  it("assigns ownership server-side to the authenticated household", async () => {
    const contact = await enrollPhone();
    const stored = await getRepositories().trustedContacts.getInternalById(
      contact.id,
    );
    expect(stored?.householdId).toBe(HOUSEHOLD);
  });

  it("scopes lists to the household", async () => {
    await enrollPhone();
    const list = await listContacts(HOUSEHOLD);
    // Seeded demo contact + the one we added.
    expect(list.length).toBe(2);
  });

  it("enforces the per-household destination limit", async () => {
    // One contact is seeded; create up to the default cap of 10.
    for (let i = 0; i < 9; i += 1) {
      await enrollPhone(`+1609555${1000 + i}`);
    }
    await expect(enrollPhone("+16095559999")).rejects.toMatchObject({
      code: "LIMIT_EXCEEDED",
    });
  });
});

describe("ownership enforcement", () => {
  it("rejects cross-household reads", async () => {
    const contact = await enrollPhone();
    await expect(getContact(OTHER_HOUSEHOLD, contact.id)).rejects.toMatchObject(
      { code: "FORBIDDEN" },
    );
  });

  it("rejects cross-household updates", async () => {
    const contact = await enrollPhone();
    await expect(
      updateContact(OTHER_HOUSEHOLD, contact.id, { phone: "+16095551213" }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("rejects cross-household deletes", async () => {
    const contact = await enrollPhone();
    await expect(
      removeContact(OTHER_HOUSEHOLD, contact.id),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("returns NOT_FOUND for unknown ids", async () => {
    await expect(getContact(HOUSEHOLD, "missing")).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
  });
});

describe("destination verification (separate workflow)", () => {
  it("records timestamp and channel on success", async () => {
    const contact = await enrollPhone();
    const start = await startDestinationVerification(
      HOUSEHOLD,
      contact.id,
      "sms",
    );
    expect(start.demoCode).toBeDefined();
    const verified = await completeDestinationVerification(
      HOUSEHOLD,
      contact.id,
      start.demoCode!,
    );
    expect(verified.verified).toBe(true);
    expect(verified.verifiedAt).not.toBeNull();
    expect(verified.verifiedChannel).toBe("sms");
  });

  it("does not verify on an incorrect code", async () => {
    const contact = await enrollPhone();
    await startDestinationVerification(HOUSEHOLD, contact.id, "sms");
    await expect(
      completeDestinationVerification(HOUSEHOLD, contact.id, "000000"),
    ).rejects.toMatchObject({ code: "VERIFICATION_FAILED" });
    const after = await getContact(HOUSEHOLD, contact.id);
    expect(after.verified).toBe(false);
  });

  it("clears verification state when the destination is updated", async () => {
    const contact = await enrollPhone();
    const start = await startDestinationVerification(
      HOUSEHOLD,
      contact.id,
      "sms",
    );
    await completeDestinationVerification(
      HOUSEHOLD,
      contact.id,
      start.demoCode!,
    );
    const updated = await updateContact(HOUSEHOLD, contact.id, {
      phone: "+16095551213",
    });
    expect(updated.verified).toBe(false);
    expect(updated.verifiedAt).toBeNull();
    expect(updated.verifiedChannel).toBeNull();
  });

  it("rejects an sms verification on an email-only destination", async () => {
    const contact = await enrollContact(HOUSEHOLD, {
      displayName: "A",
      email: "a@b.com",
    });
    await expect(
      startDestinationVerification(HOUSEHOLD, contact.id, "sms"),
    ).rejects.toMatchObject({ code: "VALIDATION" });
  });

  it("rate-limits verification starts per window", async () => {
    const contact = await enrollPhone();
    for (let i = 0; i < 5; i += 1) {
      await startDestinationVerification(HOUSEHOLD, contact.id, "sms");
    }
    await expect(
      startDestinationVerification(HOUSEHOLD, contact.id, "sms"),
    ).rejects.toMatchObject({ code: "LIMIT_EXCEEDED" });
  });

  it("locks a challenge after too many incorrect attempts", async () => {
    const contact = await enrollPhone();
    await startDestinationVerification(HOUSEHOLD, contact.id, "sms");
    for (let i = 0; i < 5; i += 1) {
      await expect(
        completeDestinationVerification(HOUSEHOLD, contact.id, "000000"),
      ).rejects.toMatchObject({ code: "VERIFICATION_FAILED" });
    }
    await expect(
      completeDestinationVerification(HOUSEHOLD, contact.id, "000000"),
    ).rejects.toMatchObject({ code: "LIMIT_EXCEEDED" });
  });
});

describe("high-trust gate", () => {
  it("blocks unverified destinations", async () => {
    const contact = await enrollPhone();
    await expect(
      assertHighTrustEligible(HOUSEHOLD, contact.id),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("allows verified destinations", async () => {
    const contact = await enrollPhone();
    const start = await startDestinationVerification(
      HOUSEHOLD,
      contact.id,
      "sms",
    );
    await completeDestinationVerification(
      HOUSEHOLD,
      contact.id,
      start.demoCode!,
    );
    const eligible = await assertHighTrustEligible(HOUSEHOLD, contact.id);
    expect(eligible.verified).toBe(true);
  });
});
