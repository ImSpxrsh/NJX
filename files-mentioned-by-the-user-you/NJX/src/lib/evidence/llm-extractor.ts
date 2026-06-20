import type { EvidenceExtractor } from "./extractor";
import type { EvidenceExtraction } from "@/types/domain";
import { FixtureEvidenceExtractor } from "./fixture-extractor";

// The provider boundary is intentionally present before a model SDK is added.
// Until configured and reviewed, failure safely falls back to deterministic evidence.
export class LlmEvidenceExtractor implements EvidenceExtractor {
  constructor(
    private readonly fallback: EvidenceExtractor = new FixtureEvidenceExtractor(),
  ) {}

  async extract(input: {
    text: string;
    requestId: string;
  }): Promise<EvidenceExtraction> {
    return this.fallback.extract(input);
  }
}
