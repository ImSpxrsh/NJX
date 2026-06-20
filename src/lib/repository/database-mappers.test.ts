import { describe, expect, it } from "vitest";
import { FixtureEvidenceExtractor } from "@/lib/evidence/fixture-extractor";
import { fixtures } from "@/fixtures/messages";
import { mapCheckRow, mapPublicCheckRow } from "./database-mappers";

const timestamp = "2026-06-20T12:00:00.000Z";

async function validCheckRow() {
  const evidence = await new FixtureEvidenceExtractor().extract({
    text: fixtures.ordinary,
    requestId: "mapper-test",
  });
  return {
    id: "00000000-0000-4000-8000-000000000010",
    household_id: "00000000-0000-4000-8000-000000000001",
    source: "web",
    state: "PAUSED",
    verification_level: "L0",
    sanitized_summary: evidence.plainLanguageSummary,
    evidence_json: evidence,
    policy_reasons: ["No listed warning signs were identified."],
    created_at: timestamp,
    updated_at: timestamp,
    expires_at: null,
  };
}

describe("database mappers", () => {
  it("maps a valid check row", async () => {
    const mapped = mapCheckRow(await validCheckRow());
    expect(mapped).toMatchObject({
      state: "PAUSED",
      verificationLevel: "L0",
      expiresAt: null,
      statusSource: "POLICY_ENGINE",
    });
  });

  it("rejects an unknown check state", async () => {
    const row = await validCheckRow();
    expect(() => mapCheckRow({ ...row, state: "APPROVED" })).toThrow();
  });

  it("rejects invalid stored evidence", async () => {
    const row = await validCheckRow();
    expect(() =>
      mapCheckRow({
        ...row,
        evidence_json: { schemaVersion: "1.0", verified: true },
      }),
    ).toThrow();
  });

  it("does not expose token hashes in a public check", async () => {
    const publicCheck = mapPublicCheckRow(await validCheckRow());
    expect(JSON.stringify(publicCheck)).not.toContain("tokenHash");
    expect(JSON.stringify(publicCheck)).not.toContain("token_hash");
    expect(publicCheck).not.toHaveProperty("householdId");
    expect(publicCheck).not.toHaveProperty("extraction");
  });

  it("preserves nullable expiry intentionally", async () => {
    expect(mapCheckRow(await validCheckRow()).expiresAt).toBeNull();
    expect(
      mapCheckRow({
        ...(await validCheckRow()),
        expires_at: "2026-06-20T12:10:00.000Z",
      }).expiresAt,
    ).toBe("2026-06-20T12:10:00.000Z");
  });
});
