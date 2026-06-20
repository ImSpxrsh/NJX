import { describe, expect, it } from "vitest";
import { evidenceExtractionSchema } from "./schema";
import { FixtureEvidenceExtractor } from "./fixture-extractor";
import { fixtures } from "@/fixtures/messages";

describe("evidenceExtractionSchema", () => {
  it("accepts a valid extraction", async () => {
    const extraction = await new FixtureEvidenceExtractor().extract({
      text: fixtures.ordinary,
      requestId: "test",
    });
    expect(evidenceExtractionSchema.parse(extraction)).toEqual(extraction);
  });

  it("rejects out-of-range scores", async () => {
    const extraction = await new FixtureEvidenceExtractor().extract({
      text: fixtures.ordinary,
      requestId: "test",
    });
    extraction.signals.urgency.score = 2;
    expect(() => evidenceExtractionSchema.parse(extraction)).toThrow();
  });

  it("rejects missing signals and unknown trust fields", async () => {
    const extraction = await new FixtureEvidenceExtractor().extract({
      text: fixtures.ordinary,
      requestId: "test",
    });
    const missing = structuredClone(extraction) as Record<string, unknown>;
    delete (missing.signals as Record<string, unknown>).payment;
    expect(() => evidenceExtractionSchema.parse(missing)).toThrow();
    expect(() =>
      evidenceExtractionSchema.parse({ ...extraction, verified: true }),
    ).toThrow();
  });

  it("rejects excessive generated output", async () => {
    const extraction = await new FixtureEvidenceExtractor().extract({
      text: fixtures.ordinary,
      requestId: "test",
    });
    extraction.plainLanguageSummary = "x".repeat(501);
    expect(() => evidenceExtractionSchema.parse(extraction)).toThrow();
  });
});
