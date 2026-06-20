import type { EvidenceExtraction } from "@/types/domain";

export interface EvidenceExtractor {
  extract(input: {
    text: string;
    requestId: string;
  }): Promise<EvidenceExtraction>;
}
