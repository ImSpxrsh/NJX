import { beforeEach, describe, expect, it } from "vitest";
import { FixtureEvidenceExtractor } from "@/lib/evidence/fixture-extractor";
import { evaluatePolicy } from "@/lib/policy/evaluate-policy";
import { fixtures } from "@/fixtures/messages";
import {
  createCheck,
  getCheck,
  resetDemo,
  respondToVerification,
} from "./demo-store";

describe("trusted-contact loop", () => {
  beforeEach(resetDemo);

  async function setup() {
    const extraction = await new FixtureEvidenceExtractor().extract({
      text: fixtures.giftCardEmergency,
      requestId: "test",
    });
    return createCheck({ extraction, decision: evaluatePolicy(extraction) });
  }

  it("accepts a valid token once", async () => {
    const { check, verification } = await setup();
    expect(verification).toBeDefined();
    expect(
      respondToVerification(verification!.rawToken, "DENIED_MINE").ok,
    ).toBe(true);
    expect(getCheck(check.id)?.state).toBe("DENIED");
    expect(
      respondToVerification(verification!.rawToken, "CONFIRMED_MINE"),
    ).toMatchObject({ ok: false, code: "ALREADY_USED" });
  });

  it("CALL_ME never verifies and cannot be replayed", async () => {
    const { check, verification } = await setup();
    expect(
      respondToVerification(verification!.rawToken, "CALL_ME"),
    ).toMatchObject({ ok: true, state: "PENDING" });
    expect(getCheck(check.id)?.state).toBe("PENDING");
    expect(
      respondToVerification(verification!.rawToken, "CONFIRMED_MINE"),
    ).toMatchObject({ ok: false, code: "ALREADY_USED" });
  });

  it("rejects malformed tokens", () => {
    expect(respondToVerification("bad", "CONFIRMED_MINE")).toMatchObject({
      ok: false,
      code: "INVALID_TOKEN",
    });
  });

  it("never stores the raw suspicious message", async () => {
    const { check } = await setup();
    expect(JSON.stringify(check)).not.toContain(fixtures.giftCardEmergency);
  });
});
