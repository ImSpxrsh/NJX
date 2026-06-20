import { beforeEach, describe, expect, it } from "vitest";
import { FixtureEvidenceExtractor } from "@/lib/evidence/fixture-extractor";
import { evaluatePolicy } from "@/lib/policy/evaluate-policy";
import { fixtures } from "@/fixtures/messages";
import {
  createDemoRepositories,
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

  it("maps confirmation only to VERIFIED", async () => {
    const { check, verification } = await setup();
    expect(
      respondToVerification(verification!.rawToken, "CONFIRMED_MINE"),
    ).toMatchObject({ ok: true, state: "VERIFIED" });
    expect(getCheck(check.id)?.state).toBe("VERIFIED");
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

  it("does not transition an expired request", async () => {
    const previousTtl = process.env.VERIFICATION_TOKEN_TTL_MINUTES;
    process.env.VERIFICATION_TOKEN_TTL_MINUTES = "-1";
    try {
      const { check, verification } = await setup();
      expect(
        respondToVerification(verification!.rawToken, "CONFIRMED_MINE"),
      ).toMatchObject({ ok: false, code: "EXPIRED" });
      expect(getCheck(check.id)?.state).toBe("EXPIRED");
    } finally {
      if (previousTtl === undefined) {
        delete process.env.VERIFICATION_TOKEN_TTL_MINUTES;
      } else {
        process.env.VERIFICATION_TOKEN_TTL_MINUTES = previousTtl;
      }
    }
  });

  it("accepts only one concurrent response", async () => {
    const repositories = createDemoRepositories();
    const extraction = await new FixtureEvidenceExtractor().extract({
      text: fixtures.giftCardEmergency,
      requestId: "test",
    });
    const { check, verification } = await repositories.checks.create({
      householdId: "00000000-0000-4000-8000-000000000001",
      source: "web",
      extraction,
      decision: evaluatePolicy(extraction),
    });

    const results = await Promise.all([
      repositories.verificationRequests.respond(
        verification!.rawToken!,
        "CONFIRMED_MINE",
      ),
      repositories.verificationRequests.respond(
        verification!.rawToken!,
        "DENIED_MINE",
      ),
    ]);

    expect(results.filter((result) => result.ok)).toHaveLength(1);
    expect(results.filter((result) => !result.ok)).toHaveLength(1);
    expect(["VERIFIED", "DENIED"]).toContain(getCheck(check.id)?.state);
  });

  it("never stores the raw suspicious message", async () => {
    const { check } = await setup();
    expect(JSON.stringify(check)).not.toContain(fixtures.giftCardEmergency);
  });

  it("rejects an unrelated household through the repository boundary", async () => {
    const extraction = await new FixtureEvidenceExtractor().extract({
      text: fixtures.ordinary,
      requestId: "test",
    });
    await expect(
      createDemoRepositories().checks.create({
        householdId: "00000000-0000-4000-8000-000000000099",
        source: "web",
        extraction,
        decision: evaluatePolicy(extraction),
      }),
    ).rejects.toThrow("Demo household unavailable");
  });

  it("omits evidence spans from public-safe reads", async () => {
    const extraction = await new FixtureEvidenceExtractor().extract({
      text: fixtures.giftCardEmergency,
      requestId: "test",
    });
    const created = await createDemoRepositories().checks.create({
      householdId: "00000000-0000-4000-8000-000000000001",
      source: "web",
      extraction,
      decision: evaluatePolicy(extraction),
    });
    expect(JSON.stringify(created.check)).not.toContain("evidenceSpans");
    expect(created.check).not.toHaveProperty("householdId");
    expect(created.check).not.toHaveProperty("extraction");
  });
});
