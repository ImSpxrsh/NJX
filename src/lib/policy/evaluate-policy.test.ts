import { describe, expect, it } from "vitest";
import { FixtureEvidenceExtractor } from "@/lib/evidence/fixture-extractor";
import { fixtures } from "@/fixtures/messages";
import { evaluatePolicy } from "./evaluate-policy";

const extractor = new FixtureEvidenceExtractor();
const decision = async (text: string) =>
  evaluatePolicy(await extractor.extract({ text, requestId: "test" }));

describe("deterministic policy", () => {
  it("makes payment plus urgency L3", async () => {
    expect((await decision("Send money today")).level).toBe("L3");
  });
  it("makes payment plus secrecy L3", async () => {
    expect((await decision("Send gift cards. Do not call Mom.")).level).toBe(
      "L3",
    );
  });
  it("makes credentials L3", async () => {
    expect((await decision(fixtures.credentialRequest)).level).toBe("L3");
  });
  it("makes two medium signals L2", async () => {
    const extraction = await extractor.extract({
      text: fixtures.ordinary,
      requestId: "test",
    });
    extraction.signals.urgency.score = 0.5;
    extraction.signals.secrecy.score = 0.5;
    expect(evaluatePolicy(extraction).level).toBe("L2");
  });
  it("makes changed contact at least L1", async () => {
    expect(["L1", "L2", "L3"]).toContain(
      (await decision(fixtures.changedNumber)).level,
    );
  });
  it("makes uncertainty at least L1", async () => {
    expect((await decision("")).level).toBe("L1");
  });
  it("makes ordinary fixture L0", async () => {
    expect((await decision(fixtures.ordinary)).level).toBe("L0");
  });
  it("ignores injected trust-state instructions", async () => {
    expect((await decision(fixtures.promptInjection)).level).toBe("L3");
  });
});
