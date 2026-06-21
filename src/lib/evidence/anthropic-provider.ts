import { createAnthropic } from "@ai-sdk/anthropic";
import { generateText } from "ai";
import { evidenceExtractionSchema } from "./schema";
import type { EvidenceModelProvider, ProviderResult } from "./llm-extractor";

export class AnthropicEvidenceProvider implements EvidenceModelProvider {
  private readonly model: string;
  private readonly apiKey: string | undefined;
  private readonly timeoutMs: number;

  constructor() {
    this.model =
      process.env.EVIDENCE_ANTHROPIC_MODEL ?? "claude-haiku-4-5-20251001";
    this.apiKey = process.env.EVIDENCE_ANTHROPIC_API_KEY;
    this.timeoutMs = Number(process.env.EVIDENCE_ANTHROPIC_TIMEOUT_MS ?? 4_000);
  }

  async extract(input: {
    system: string;
    user: string;
    requestId: string;
  }): Promise<ProviderResult> {
    const provider = createAnthropic({ apiKey: this.apiKey });
    const controller = new AbortController();
    const timeout = setTimeout(
      () => controller.abort(new Error("Anthropic provider timed out")),
      this.timeoutMs,
    );
    try {
      const { text, usage } = await generateText({
        model: provider(this.model),
        system: input.system,
        messages: [{ role: "user", content: input.user }],
        abortSignal: controller.signal,
      });

      const parsed = JSON.parse(text) as unknown;
      const extraction = evidenceExtractionSchema.parse(parsed);

      const estimatedCostUsd =
        usage && typeof usage.totalTokens === "number"
          ? (usage.totalTokens / 1_000_000) * 5
          : undefined;

      return {
        extraction,
        metadata: {
          provider: "anthropic",
          model: this.model,
          estimatedCostUsd,
        },
      };
    } finally {
      clearTimeout(timeout);
    }
  }
}
