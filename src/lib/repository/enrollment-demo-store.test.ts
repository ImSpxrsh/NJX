import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createVerificationToken } from "@/lib/security/tokens";
import { hashEnrollmentLinkToken } from "@/lib/security/enrollment-tokens";
import type { EnrollmentVerificationRepository } from "./contracts";
import { createDemoRepositories, resetDemo, store } from "./demo-store";

const HH = "11111111-1111-4111-8111-111111111111";
const OTHER_HH = "22222222-2222-4222-8222-222222222222";

let repo: EnrollmentVerificationRepository;
const savedEnv = { ...process.env };

beforeEach(() => {
  process.env = { ...savedEnv };
  resetDemo();
  repo = createDemoRepositories().enrollmentVerifications;
});

afterEach(() => {
  vi.useRealTimers();
  process.env = { ...savedEnv };
});

async function newContact(
  channel: "sms" | "email",
  destination: string,
  household = HH,
) {
  const result = await repo.createContact({
    householdId: household,
    displayName: "Trusted Contact",
    channel,
    destination,
  });
  if (!result.ok) throw new Error("contact setup failed");
  return result.contact;
}

async function startFor(contactId: string, household = HH) {
  const result = await repo.start({
    householdId: household,
    trustedContactId: contactId,
  });
  if (!result.ok) throw new Error(`start failed: ${result.code}`);
  return result;
}

function wrongCode(code: string): string {
  return code === "00000000" ? "11111111" : "00000000";
}

describe("CC-202 enrollment destination verification", () => {
  it("verifies an email destination via a one-time link and marks it verified", async () => {
    const contact = await newContact("email", "person@example.com");
    const started = await startFor(contact.id);
    expect(started.channel).toBe("email");
    if (started.deliverySecret.kind !== "link")
      throw new Error("expected link");

    const confirmed = await repo.confirmByToken(
      started.deliverySecret.rawToken,
    );
    expect(confirmed).toEqual({ ok: true, status: "VERIFIED" });

    const status = await repo.getStatus(contact.id);
    expect(status?.destinationVerified).toBe(true);
  });

  it("verifies an SMS destination via a one-time code", async () => {
    const contact = await newContact("sms", "+15551234567");
    const started = await startFor(contact.id);
    if (started.deliverySecret.kind !== "code")
      throw new Error("expected code");

    const confirmed = await repo.confirmByCode(
      contact.id,
      started.deliverySecret.code,
    );
    expect(confirmed).toEqual({ ok: true, status: "VERIFIED" });
    expect((await repo.getStatus(contact.id))?.destinationVerified).toBe(true);
  });

  it("rejects a replayed (already used) link", async () => {
    const contact = await newContact("email", "person@example.com");
    const started = await startFor(contact.id);
    if (started.deliverySecret.kind !== "link")
      throw new Error("expected link");
    const token = started.deliverySecret.rawToken;

    expect((await repo.confirmByToken(token)).ok).toBe(true);
    expect(await repo.confirmByToken(token)).toEqual({
      ok: false,
      code: "INVALID",
    });
  });

  it("locks an SMS code after the maximum number of wrong attempts (brute force)", async () => {
    process.env.ENROLLMENT_MAX_ATTEMPTS = "3";
    resetDemo();
    repo = createDemoRepositories().enrollmentVerifications;

    const contact = await newContact("sms", "+15551234567");
    const started = await startFor(contact.id);
    if (started.deliverySecret.kind !== "code")
      throw new Error("expected code");
    const bad = wrongCode(started.deliverySecret.code);

    for (let i = 0; i < 3; i += 1) {
      expect(await repo.confirmByCode(contact.id, bad)).toEqual({
        ok: false,
        code: "INVALID",
      });
    }
    // Even the correct code is now rejected: the record is locked.
    expect(
      await repo.confirmByCode(contact.id, started.deliverySecret.code),
    ).toEqual({
      ok: false,
      code: "INVALID",
    });
    expect((await repo.getStatus(contact.id))?.destinationVerified).toBe(false);
  });

  it("rejects an expired secret without verifying", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-01T00:00:00Z"));
    const contact = await newContact("email", "person@example.com");
    const started = await startFor(contact.id);
    if (started.deliverySecret.kind !== "link")
      throw new Error("expected link");

    vi.setSystemTime(new Date("2026-01-01T01:00:00Z")); // well past TTL
    expect(await repo.confirmByToken(started.deliverySecret.rawToken)).toEqual({
      ok: false,
      code: "INVALID",
    });
    expect((await repo.getStatus(contact.id))?.destinationVerified).toBe(false);
  });

  it("treats a cross-household start as an indistinguishable not-found", async () => {
    const contact = await newContact("email", "person@example.com", HH);
    const result = await repo.start({
      householdId: OTHER_HH,
      trustedContactId: contact.id,
    });
    expect(result).toEqual({ ok: false, code: "CONTACT_NOT_FOUND" });
  });

  it("clears verification when the destination changes and invalidates pending secrets", async () => {
    const contact = await newContact("sms", "+15551230000");
    const started = await startFor(contact.id);
    if (started.deliverySecret.kind !== "code")
      throw new Error("expected code");

    const change = await repo.changeDestination({
      trustedContactId: contact.id,
      channel: "sms",
      destination: "+15559998888",
    });
    expect(change.ok).toBe(true);

    // The previously issued code can no longer verify the (now changed) value.
    expect(
      await repo.confirmByCode(contact.id, started.deliverySecret.code),
    ).toEqual({ ok: false, code: "INVALID" });
    expect((await repo.getStatus(contact.id))?.destinationVerified).toBe(false);
  });

  it("clears a previously verified destination after a change", async () => {
    const contact = await newContact("email", "old@example.com");
    const started = await startFor(contact.id);
    if (started.deliverySecret.kind !== "link")
      throw new Error("expected link");
    await repo.confirmByToken(started.deliverySecret.rawToken);
    expect((await repo.getStatus(contact.id))?.destinationVerified).toBe(true);

    await repo.changeDestination({
      trustedContactId: contact.id,
      channel: "email",
      destination: "new@example.com",
    });
    expect((await repo.getStatus(contact.id))?.destinationVerified).toBe(false);
  });

  it("never stores the raw secret and never exposes it in status reads", async () => {
    const contact = await newContact("email", "person@example.com");
    const started = await startFor(contact.id);
    if (started.deliverySecret.kind !== "link")
      throw new Error("expected link");
    const token = started.deliverySecret.rawToken;

    const record = [...store.enrollments.values()][0]!;
    expect(record.secretHash).toBe(hashEnrollmentLinkToken(token));
    expect(JSON.stringify(record)).not.toContain(token);

    const status = await repo.getStatus(contact.id);
    const serialized = JSON.stringify(status);
    expect(serialized).not.toContain("person@example.com");
    expect(serialized).not.toContain(record.secretHash);
    expect(status).not.toHaveProperty("destination");
    expect(status).not.toHaveProperty("householdId");
    expect(status).not.toHaveProperty("secretHash");
  });

  it("consumes a link exactly once under concurrent confirmation", async () => {
    const contact = await newContact("email", "person@example.com");
    const started = await startFor(contact.id);
    if (started.deliverySecret.kind !== "link")
      throw new Error("expected link");
    const token = started.deliverySecret.rawToken;

    const [a, b] = await Promise.all([
      repo.confirmByToken(token),
      repo.confirmByToken(token),
    ]);
    expect([a.ok, b.ok].filter(Boolean)).toHaveLength(1);
  });

  it("rate-limits start requests without revealing contact state", async () => {
    process.env.ENROLLMENT_START_LIMIT = "2";
    resetDemo();
    repo = createDemoRepositories().enrollmentVerifications;
    const contact = await newContact("email", "person@example.com");

    expect(
      (await repo.start({ householdId: HH, trustedContactId: contact.id })).ok,
    ).toBe(true);
    expect(
      (await repo.start({ householdId: HH, trustedContactId: contact.id })).ok,
    ).toBe(true);
    expect(
      await repo.start({ householdId: HH, trustedContactId: contact.id }),
    ).toEqual({
      ok: false,
      code: "RATE_LIMITED",
    });
  });

  it("rejects malformed confirmation inputs", async () => {
    expect(await repo.confirmByToken("not-a-token")).toEqual({
      ok: false,
      code: "INVALID",
    });
    expect(await repo.confirmByCode(HH, "abc")).toEqual({
      ok: false,
      code: "INVALID",
    });
  });

  it("keeps enrollment and request-verification tokens non-interchangeable", async () => {
    // A request-verification token cannot satisfy an enrollment confirmation.
    const requestToken = createVerificationToken().rawToken;
    expect(await repo.confirmByToken(requestToken)).toEqual({
      ok: false,
      code: "INVALID",
    });

    // An enrollment link token cannot satisfy a request-verification response.
    const contact = await newContact("email", "person@example.com");
    const started = await startFor(contact.id);
    if (started.deliverySecret.kind !== "link")
      throw new Error("expected link");
    const requests = createDemoRepositories().verificationRequests;
    const crossUse = await requests.respond(
      started.deliverySecret.rawToken,
      "CONFIRMED_MINE",
    );
    expect(crossUse).toMatchObject({ ok: false });
  });
});
