import type { EvidenceExtractor } from "./extractor";
import type {
  EvidenceExtraction,
  EvidenceSignal,
  SignalName,
} from "@/types/domain";
import { FixtureEvidenceExtractor } from "./fixture-extractor";
import { evidenceExtractionSchema } from "./schema";
import { evidenceSystemInstruction, wrapUntrustedMessage } from "./prompt";
import { DETERMINISTIC_RULE_VERSION, PROMPT_VERSION } from "./versions";

type ProviderMetadata = {
  provider: string;
  model: string;
  estimatedCostUsd?: number;
};

export type ProviderResult = {
  extraction: unknown;
  metadata: ProviderMetadata;
};

export interface EvidenceModelProvider {
  extract(input: {
    system: string;
    user: string;
    requestId: string;
  }): Promise<ProviderResult>;
}

export class FetchJsonEvidenceProvider implements EvidenceModelProvider {
  constructor(
    private readonly config = {
      url: process.env.EVIDENCE_LLM_API_URL,
      apiKey: process.env.EVIDENCE_LLM_API_KEY,
      model: process.env.EVIDENCE_LLM_MODEL ?? "configured-json-model",
      timeoutMs: Number(process.env.EVIDENCE_LLM_TIMEOUT_MS ?? 4_000),
    },
  ) {}

  async extract(input: {
    system: string;
    user: string;
    requestId: string;
  }): Promise<ProviderResult> {
    if (!this.config.url) throw new Error("LLM provider is not configured.");
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.config.timeoutMs);
    try {
      const response = await fetch(this.config.url, {
        method: "POST",
        signal: controller.signal,
        headers: {
          "Content-Type": "application/json",
          ...(this.config.apiKey
            ? { Authorization: `Bearer ${this.config.apiKey}` }
            : {}),
        },
        body: JSON.stringify({
          model: this.config.model,
          response_format: { type: "json_object" },
          messages: [
            { role: "system", content: input.system },
            { role: "user", content: input.user },
          ],
        }),
      });
      if (!response.ok) throw new Error("LLM provider request failed.");
      const body = (await response.json()) as {
        output?: unknown;
        choices?: Array<{ message?: { content?: string } }>;
        usage?: { total_tokens?: number };
      };
      const content =
        body.output ??
        (body.choices?.[0]?.message?.content
          ? JSON.parse(body.choices[0].message.content)
          : undefined);
      return {
        extraction: content,
        metadata: {
          provider: "fetch-json",
          model: this.config.model,
          estimatedCostUsd:
            typeof body.usage?.total_tokens === "number"
              ? (body.usage.total_tokens / 1_000_000) * 2
              : undefined,
        },
      };
    } finally {
      clearTimeout(timeout);
    }
  }
}

function moreConservativeSignal(
  deterministic: EvidenceSignal,
  model: EvidenceSignal,
): EvidenceSignal {
  if (deterministic.present && !model.present) return deterministic;
  if (model.present && !deterministic.present) return model;
  return model.score > deterministic.score ? model : deterministic;
}

function combineEvidence(
  deterministic: EvidenceExtraction,
  model: EvidenceExtraction,
  metadata: ProviderMetadata,
): EvidenceExtraction {
  const signals = Object.fromEntries(
    (Object.keys(deterministic.signals) as SignalName[]).map((name) => [
      name,
      moreConservativeSignal(deterministic.signals[name], model.signals[name]),
    ]),
  ) as Record<SignalName, EvidenceSignal>;
  const disagreement = (Object.keys(signals) as SignalName[]).some(
    (name) =>
      deterministic.signals[name].present !== model.signals[name].present,
  );
  return evidenceExtractionSchema.parse({
    ...deterministic,
    requestedAction:
      deterministic.requestedAction ?? model.requestedAction ?? null,
    claimedIdentity: deterministic.claimedIdentity ?? model.claimedIdentity,
    signals,
    uncertainty: deterministic.uncertainty || model.uncertainty || disagreement,
    metadata: {
      promptVersion: PROMPT_VERSION,
      deterministicRuleVersion: DETERMINISTIC_RULE_VERSION,
      provider: metadata.provider,
      model: metadata.model,
      fallbackUsed: false,
      ruleIds: deterministic.metadata?.ruleIds,
    },
  });
}

export class LlmEvidenceExtractor implements EvidenceExtractor {
  constructor(
    private readonly fallback: EvidenceExtractor = new FixtureEvidenceExtractor(),
    private readonly provider?: EvidenceModelProvider,
  ) {}

  async extract(input: {
    text: string;
    requestId: string;
  }): Promise<EvidenceExtraction> {
    const deterministic = await this.fallback.extract(input);
    const provider = this.provider ?? new FetchJsonEvidenceProvider();
    try {
      const providerResult = await provider.extract({
        system: evidenceSystemInstruction,
        user: wrapUntrustedMessage(input.text.slice(0, 4_000)),
        requestId: input.requestId,
      });
      const model = evidenceExtractionSchema.parse(providerResult.extraction);
      return combineEvidence(deterministic, model, providerResult.metadata);
    } catch {
      return evidenceExtractionSchema.parse({
        ...deterministic,
        metadata: {
          ...deterministic.metadata,
          provider: "deterministic-fallback",
          model: null,
          fallbackUsed: true,
        },
      });
    }
  }
}
