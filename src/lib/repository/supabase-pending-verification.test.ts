import { describe, expect, it } from "vitest";
import type { PendingVerificationDataSource } from "./supabase-pending-verification";
import { SupabasePendingVerificationCreator } from "./supabase-pending-verification";

const householdA = "00000000-0000-4000-8000-000000000001";
const householdB = "00000000-0000-4000-8000-000000000002";
const contactA = "00000000-0000-4000-8000-000000000011";
const contactB = "00000000-0000-4000-8000-000000000012";
const checkId = "00000000-0000-4000-8000-000000000021";
const expiresAt = "2026-06-20T12:10:00.000Z";

class TransactionalFakeDataSource implements PendingVerificationDataSource {
  contacts = new Map([
    [householdA, contactA],
    [householdB, contactB],
  ]);
  contactHouseholds = new Map([
    [contactA, householdA],
    [contactB, householdB],
  ]);
  checks = new Map([
    [
      checkId,
      {
        householdId: householdA,
        state: "PAUSED",
        level: "L3",
        expiresAt: null as string | null,
      },
    ],
  ]);
  requests: Array<{
    checkId: string;
    trustedContactId: string;
    tokenHash: string;
  }> = [];
  lastInput:
    | Parameters<PendingVerificationDataSource["createPending"]>[0]
    | null = null;
  failAfterInsert = false;
  private lock: Promise<void> = Promise.resolve();

  async getVerifiedContactId(householdId: string) {
    return this.contacts.get(householdId) ?? null;
  }

  async createPending(
    input: Parameters<PendingVerificationDataSource["createPending"]>[0],
  ) {
    const previous = this.lock;
    let release = () => {};
    this.lock = new Promise<void>((resolve) => {
      release = resolve;
    });
    await previous;
    try {
      this.lastInput = structuredClone(input);
      const check = this.checks.get(input.checkId);
      if (
        !check ||
        check.state !== "PAUSED" ||
        !["L2", "L3"].includes(check.level)
      ) {
        throw new Error("check unavailable");
      }
      if (
        this.contactHouseholds.get(input.trustedContactId) !== check.householdId
      ) {
        throw new Error("contact unavailable");
      }
      if (this.requests.some((request) => request.checkId === input.checkId)) {
        throw new Error("active request exists");
      }

      const snapshot = structuredClone(check);
      this.requests.push({
        checkId: input.checkId,
        trustedContactId: input.trustedContactId,
        tokenHash: input.tokenHash,
      });
      try {
        if (this.failAfterInsert) throw new Error("forced rollback");
        check.state = "PENDING";
        check.expiresAt = input.expiresAt;
      } catch (error) {
        this.requests.pop();
        this.checks.set(input.checkId, snapshot);
        throw error;
      }
      return {
        requestId: "00000000-0000-4000-8000-000000000031",
        expiresAt: input.expiresAt,
      };
    } finally {
      release();
    }
  }
}

describe("SupabasePendingVerificationCreator", () => {
  it("sends only the token hash to persistence and returns the raw token once", async () => {
    const dataSource = new TransactionalFakeDataSource();
    const result = await new SupabasePendingVerificationCreator(
      dataSource,
    ).create({ checkId, householdId: householdA, expiresAt });

    expect(result.rawToken).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(dataSource.lastInput?.tokenHash).toMatch(/^[0-9a-f]{64}$/);
    expect(JSON.stringify(dataSource.lastInput)).not.toContain(result.rawToken);
    expect(dataSource.checks.get(checkId)?.state).toBe("PENDING");
  });

  it("allows exactly one of two simultaneous creation attempts", async () => {
    const dataSource = new TransactionalFakeDataSource();
    const creator = new SupabasePendingVerificationCreator(dataSource);
    const results = await Promise.allSettled([
      creator.create({ checkId, householdId: householdA, expiresAt }),
      creator.create({ checkId, householdId: householdA, expiresAt }),
    ]);

    expect(
      results.filter((result) => result.status === "fulfilled"),
    ).toHaveLength(1);
    expect(
      results.filter((result) => result.status === "rejected"),
    ).toHaveLength(1);
    expect(dataSource.requests).toHaveLength(1);
  });

  it("rejects a contact from another household", async () => {
    const dataSource = new TransactionalFakeDataSource();
    dataSource.contacts.set(householdA, contactB);
    await expect(
      new SupabasePendingVerificationCreator(dataSource).create({
        checkId,
        householdId: householdA,
        expiresAt,
      }),
    ).rejects.toThrow("contact unavailable");
    expect(dataSource.requests).toHaveLength(0);
    expect(dataSource.checks.get(checkId)?.state).toBe("PAUSED");
  });

  it("rejects a terminal check", async () => {
    const dataSource = new TransactionalFakeDataSource();
    const check = dataSource.checks.get(checkId);
    if (check) check.state = "DENIED";
    await expect(
      new SupabasePendingVerificationCreator(dataSource).create({
        checkId,
        householdId: householdA,
        expiresAt,
      }),
    ).rejects.toThrow("check unavailable");
    expect(dataSource.requests).toHaveLength(0);
  });

  it("rolls back request creation when the state transition fails", async () => {
    const dataSource = new TransactionalFakeDataSource();
    dataSource.failAfterInsert = true;
    await expect(
      new SupabasePendingVerificationCreator(dataSource).create({
        checkId,
        householdId: householdA,
        expiresAt,
      }),
    ).rejects.toThrow("forced rollback");
    expect(dataSource.requests).toHaveLength(0);
    expect(dataSource.checks.get(checkId)?.state).toBe("PAUSED");
  });

  it("fails before token persistence when no verified contact exists", async () => {
    const dataSource = new TransactionalFakeDataSource();
    dataSource.contacts.delete(householdA);
    await expect(
      new SupabasePendingVerificationCreator(dataSource).create({
        checkId,
        householdId: householdA,
        expiresAt,
      }),
    ).rejects.toThrow("No verified trusted contact");
    expect(dataSource.lastInput).toBeNull();
  });
});
