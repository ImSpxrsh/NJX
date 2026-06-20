import "server-only";
import type { EvidenceExtractor } from "./extractor";
import type { EvidenceExtraction } from "@/types/domain";
import { DeterministicEvidenceExtractor } from "./deterministic-extractor";

// FixtureEvidenceExtractor delegates to DeterministicEvidenceExtractor.
// Preserved for backwards compatibility with existing callers and tests.
export class FixtureEvidenceExtractor implements EvidenceExtractor {
  private inner = new DeterministicEvidenceExtractor();

  async extract(input: {
    text: string;
    requestId: string;
  }): Promise<EvidenceExtraction> {
    return this.inner.extract(input);
  }
}
