import { describe, expect, it } from "vitest";
import { FixtureEvidenceExtractor } from "@/lib/evidence/fixture-extractor";
import { evaluatePolicy } from "@/lib/policy/evaluate-policy";
import { fixtures } from "@/fixtures/messages";
import type { TableInsert } from "@/types/database";
import type { PendingVerificationCreator } from "./contracts";
import {
  SupabaseCheckRepository,
  type CheckDataSource,
} from "./supabase-check-repository";

const householdId = "00000000-0000-4000-8000-000000000001";
const checkId = "00000000-0000-4000-8000-000000000010";
const timestamp = "2026-06-20T12:00:00.000Z";

class FakeCheckDataSource implements CheckDataSource {
  inserted: TableInsert<"checks"> | null = null;
  row: Record<string, unknown> | null = null;

  async insertPaused(input: TableInsert<"checks">) {
    this.inserted = structuredClone(input);
    this.row = {
      id: checkId,
      ...input,
      created_at: timestamp,
      updated_at: timestamp,
    };
    return structuredClone(this.row);
  }

  async findById(id: string, requestedHouseholdId?: string) {
    if (
      requestedHouseholdId &&
      requestedHouseholdId !== this.row?.household_id
    ) {
      return null;
    }
    return id === checkId && this.row ? structuredClone(this.row) : null;
  }
}

async function inputFor(text: string) {
  const extraction = await new FixtureEvidenceExtractor().extract({
    text,
    requestId: "supabase-check-test",
  });
  return {
    householdId,
    source: "web" as const,
    extraction,
    decision: evaluatePolicy(extraction),
  };
}

describe("SupabaseCheckRepository", () => {
  it("persists a low-concern check as PAUSED without raw input", async () => {
    const dataSource = new FakeCheckDataSource();
    const repository = new SupabaseCheckRepository(dataSource);
    const result = await repository.create(await inputFor(fixtures.ordinary));

    expect(result.check.state).toBe("PAUSED");
    expect(result.verification).toBeUndefined();
    expect(dataSource.inserted).toMatchObject({
      state: "PAUSED",
      verification_level: "L0",
      expires_at: null,
    });
    expect(JSON.stringify(dataSource.inserted)).not.toContain(
      fixtures.ordinary,
    );
  });

  it("uses a separate creator before returning an L2/L3 check as PENDING", async () => {
    const dataSource = new FakeCheckDataSource();
    const creator: PendingVerificationCreator = {
      async create({ expiresAt }) {
        dataSource.row = {
          ...dataSource.row,
          state: "PENDING",
          expires_at: expiresAt,
          updated_at: timestamp,
        };
        return {
          requestId: "00000000-0000-4000-8000-000000000020",
          expiresAt,
          rawToken: "demo-token",
        };
      },
    };
    const repository = new SupabaseCheckRepository(dataSource, creator);
    const result = await repository.create(
      await inputFor(fixtures.giftCardEmergency),
    );

    expect(result.check.state).toBe("PENDING");
    expect(result.verification?.requestId).toBe(
      "00000000-0000-4000-8000-000000000020",
    );
  });

  it("leaves a high-risk check PAUSED when verification creation fails", async () => {
    const dataSource = new FakeCheckDataSource();
    const creator: PendingVerificationCreator = {
      async create() {
        throw new Error("transaction failed");
      },
    };
    const repository = new SupabaseCheckRepository(dataSource, creator);

    await expect(
      repository.create(await inputFor(fixtures.giftCardEmergency)),
    ).rejects.toThrow("transaction failed");
    expect(dataSource.row?.state).toBe("PAUSED");
  });

  it("fails closed when no transactional creator is configured", async () => {
    const repository = new SupabaseCheckRepository(new FakeCheckDataSource());
    await expect(
      repository.create(await inputFor(fixtures.giftCardEmergency)),
    ).rejects.toThrow("transactional verification creation is unavailable");
  });

  it("returns only the public-safe check shape", async () => {
    const dataSource = new FakeCheckDataSource();
    const repository = new SupabaseCheckRepository(dataSource);
    const created = await repository.create(await inputFor(fixtures.ordinary));
    const publicCheck = await repository.getPublicById(created.check.id, {
      householdId,
    });

    expect(publicCheck).not.toHaveProperty("householdId");
    expect(publicCheck).not.toHaveProperty("extraction");
    expect(JSON.stringify(publicCheck)).not.toContain("evidenceSpans");
    expect(JSON.stringify(publicCheck)).not.toContain("token");
  });

  it("returns null for an unknown check", async () => {
    const repository = new SupabaseCheckRepository(new FakeCheckDataSource());
    await expect(
      repository.getPublicById(checkId, { householdId }),
    ).resolves.toBeNull();
  });

  it("fails closed without an authorization scope", async () => {
    const dataSource = new FakeCheckDataSource();
    const repository = new SupabaseCheckRepository(dataSource);
    const created = await repository.create(await inputFor(fixtures.ordinary));
    await expect(
      repository.getPublicById(created.check.id),
    ).resolves.toBeNull();
  });

  it("returns the same not-found result for a different household", async () => {
    const dataSource = new FakeCheckDataSource();
    const repository = new SupabaseCheckRepository(dataSource);
    const created = await repository.create(await inputFor(fixtures.ordinary));
    await expect(
      repository.getPublicById(created.check.id, {
        householdId: "00000000-0000-4000-8000-000000000099",
      }),
    ).resolves.toBeNull();
  });
});
