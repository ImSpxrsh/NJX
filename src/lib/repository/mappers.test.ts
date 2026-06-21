/**
 * CC-102: Tests for mapper functions (via the mappers.ts public API).
 */
import { describe, expect, it } from "vitest";
import { FixtureEvidenceExtractor } from "@/lib/evidence/fixture-extractor";
import { fixtures } from "@/fixtures/messages";
import {
  mapCheckRow,
  mapToPublicCheckRecord,
  mapTrustedContactRow,
  mapHouseholdRow,
  mapVerificationRequestRow,
  mapPhoneAlertRow,
} from "./mappers";

const timestamp = "2026-06-20T12:00:00.000Z";
const futureTimestamp = "2026-06-20T12:10:00.000Z";

async function buildValidCheckRow(overrides: Record<string, unknown> = {}) {
  const extractor = new FixtureEvidenceExtractor();
  const evidence = await extractor.extract({
    text: fixtures.ordinary,
    requestId: "mappers-test",
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
    requested_action: null,
    status_source: "POLICY_ENGINE",
    created_at: timestamp,
    updated_at: timestamp,
    expires_at: null,
    ...overrides,
  };
}

describe("mappers — mapCheckRow", () => {
  it("maps a valid check row to a CheckRecord", async () => {
    const row = await buildValidCheckRow();
    const result = mapCheckRow(row);
    expect(result).toMatchObject({
      id: "00000000-0000-4000-8000-000000000010",
      householdId: "00000000-0000-4000-8000-000000000001",
      source: "web",
      state: "PAUSED",
      verificationLevel: "L0",
      statusSource: "POLICY_ENGINE",
      expiresAt: null,
    });
    expect(result.extraction).toBeDefined();
    expect(result.policyReasons).toEqual([
      "No listed warning signs were identified.",
    ]);
  });

  it("reads status_source from DB row when present", async () => {
    const row = await buildValidCheckRow({
      status_source: "SYSTEM_EXPIRY",
      state: "EXPIRED",
    });
    const result = mapCheckRow(row);
    expect(result.statusSource).toBe("SYSTEM_EXPIRY");
  });

  it("derives statusSource from state when status_source is absent", async () => {
    const row = await buildValidCheckRow({ state: "PENDING" });
    // Remove status_source to simulate older rows
    const { status_source: _s, ...rowWithout } = row as Record<string, unknown>;
    void _s;
    const result = mapCheckRow(rowWithout);
    expect(result.statusSource).toBe("NO_RESPONSE");
  });

  it("throws on invalid evidence JSON", async () => {
    const row = await buildValidCheckRow({
      evidence_json: { schemaVersion: "1.0", verified: true },
    });
    expect(() => mapCheckRow(row)).toThrow();
  });

  it("preserves nullable expiresAt", async () => {
    const rowNull = await buildValidCheckRow({ expires_at: null });
    expect(mapCheckRow(rowNull).expiresAt).toBeNull();

    const rowWithExpiry = await buildValidCheckRow({
      expires_at: futureTimestamp,
    });
    expect(mapCheckRow(rowWithExpiry).expiresAt).toBe(futureTimestamp);
  });

  it("reads requested_action from DB row", async () => {
    const row = await buildValidCheckRow({
      requested_action: "Send $500 in gift cards",
    });
    const result = mapCheckRow(row);
    expect(result.requestedAction).toBe("Send $500 in gift cards");
  });
});

describe("mappers — mapToPublicCheckRecord", () => {
  it("strips internal fields and exposes signals", async () => {
    const row = await buildValidCheckRow();
    // mapToPublicCheckRecord accepts a raw DB row (same as mapPublicCheckRow)
    const publicCheck = mapToPublicCheckRecord(row);

    // Public record must not contain internal fields
    expect(publicCheck).not.toHaveProperty("householdId");
    expect(publicCheck).not.toHaveProperty("extraction");
    expect(JSON.stringify(publicCheck)).not.toContain("tokenHash");
    expect(JSON.stringify(publicCheck)).not.toContain("token_hash");
    expect(JSON.stringify(publicCheck)).not.toContain("evidenceSpans");

    // Signals are exposed (without evidenceSpans)
    expect(publicCheck.signals).toBeDefined();
    for (const signal of Object.values(publicCheck.signals)) {
      expect(signal).not.toHaveProperty("evidenceSpans");
      expect(signal).toHaveProperty("score");
      expect(signal).toHaveProperty("present");
      expect(signal).toHaveProperty("explanation");
    }
  });

  it("token hash never appears in public output", async () => {
    const row = await buildValidCheckRow();
    const publicCheck = mapToPublicCheckRecord(row);
    const json = JSON.stringify(publicCheck);
    expect(json).not.toContain("tokenHash");
    expect(json).not.toContain("token_hash");
  });
});

describe("mappers — mapTrustedContactRow", () => {
  it("maps a valid trusted contact row", () => {
    const row = {
      id: "00000000-0000-4000-8000-000000000020",
      household_id: "00000000-0000-4000-8000-000000000001",
      display_name: "Alice",
      phone_e164: "+15005550001",
      email: null,
      channel: "sms",
      destination_verified_at: null,
      destination_verified_channel: null,
      updated_at: timestamp,
      created_at: timestamp,
    };
    const result = mapTrustedContactRow(row);
    expect(result).toMatchObject({
      id: "00000000-0000-4000-8000-000000000020",
      householdId: "00000000-0000-4000-8000-000000000001",
      displayName: "Alice",
      phoneE164: "+15005550001",
      email: null,
      channel: "sms",
      destinationVerifiedAt: null,
    });
  });

  it("handles nullable destination fields", () => {
    const row = {
      id: "00000000-0000-4000-8000-000000000020",
      household_id: "00000000-0000-4000-8000-000000000001",
      display_name: "Bob",
      phone_e164: null,
      email: "bob@example.com",
      channel: "email",
      destination_verified_at: timestamp,
      destination_verified_channel: "email",
      updated_at: timestamp,
      created_at: timestamp,
    };
    const result = mapTrustedContactRow(row);
    expect(result.email).toBe("bob@example.com");
    expect(result.phoneE164).toBeNull();
    expect(result.destinationVerifiedAt).toBe(timestamp);
  });
});

describe("mappers — mapHouseholdRow", () => {
  it("maps a valid household row", () => {
    const row = {
      id: "00000000-0000-4000-8000-000000000001",
      display_name: "Smith Family",
      created_at: timestamp,
    };
    const result = mapHouseholdRow(row);
    expect(result).toEqual({
      id: "00000000-0000-4000-8000-000000000001",
      displayName: "Smith Family",
      createdAt: timestamp,
    });
  });
});

describe("mappers — mapVerificationRequestRow", () => {
  it("maps a valid verification request row", () => {
    const row = {
      id: "00000000-0000-4000-8000-000000000030",
      check_id: "00000000-0000-4000-8000-000000000010",
      trusted_contact_id: "00000000-0000-4000-8000-000000000020",
      token_hash: "a".repeat(64),
      status: "PENDING",
      response: null,
      expires_at: futureTimestamp,
      used_at: null,
      created_at: timestamp,
      responded_at: null,
    };
    const result = mapVerificationRequestRow(row);
    expect(result).toMatchObject({
      id: "00000000-0000-4000-8000-000000000030",
      checkId: "00000000-0000-4000-8000-000000000010",
      trustedContactId: "00000000-0000-4000-8000-000000000020",
      status: "PENDING",
      response: null,
      usedAt: null,
      respondedAt: null,
    });
    // Token hash is stored internally but must not appear in public surfaces
    expect(result.tokenHash).toBeDefined();
  });

  it("handles nullable timestamps correctly", () => {
    const row = {
      id: "00000000-0000-4000-8000-000000000030",
      check_id: "00000000-0000-4000-8000-000000000010",
      trusted_contact_id: "00000000-0000-4000-8000-000000000020",
      token_hash: "b".repeat(64),
      status: "COMPLETED",
      response: "CONFIRMED_MINE",
      expires_at: futureTimestamp,
      used_at: timestamp,
      created_at: timestamp,
      responded_at: timestamp,
    };
    const result = mapVerificationRequestRow(row);
    expect(result.usedAt).toBe(timestamp);
    expect(result.respondedAt).toBe(timestamp);
    expect(result.response).toBe("CONFIRMED_MINE");
  });
});

describe("mappers — mapPhoneAlertRow", () => {
  it("maps a valid phone alert row", () => {
    const row = {
      id: "00000000-0000-4000-8000-000000000040",
      household_id: "00000000-0000-4000-8000-000000000001",
      check_id: "00000000-0000-4000-8000-000000000010",
      verification_request_id: "00000000-0000-4000-8000-000000000030",
      twilio_call_sid_hash: "c".repeat(64),
      pressed_digit: "1",
      created_at: timestamp,
    };
    const result = mapPhoneAlertRow(row);
    expect(result).toMatchObject({
      id: "00000000-0000-4000-8000-000000000040",
      householdId: "00000000-0000-4000-8000-000000000001",
      checkId: "00000000-0000-4000-8000-000000000010",
      pressedDigit: "1",
      createdAt: timestamp,
    });
  });
});
