import { describe, expect, it, vi, beforeEach } from "vitest";
import { AnthropicEvidenceProvider } from "./anthropic-provider";
import { LlmEvidenceExtractor } from "./llm-extractor";
import { FixtureEvidenceExtractor } from "./fixture-extractor";
import {
  EXTRACTION_SCHEMA_VERSION,
  PROMPT_VERSION,
  DETERMINISTIC_RULE_VERSION,
} from "./versions";
import { evidenceSystemInstruction, wrapUntrustedMessage } from "./prompt";

vi.mock("@ai-sdk/anthropic", () => ({
  createAnthropic: vi.fn(() => vi.fn(() => "mock-model-instance")),
}));

vi.mock("ai", () => ({
  generateText: vi.fn(),
}));

// Minimal valid extraction matching evidenceExtractionSchema
function makeValidExtraction() {
  return {
    schemaVersion: EXTRACTION_SCHEMA_VERSION,
    requestedAction: null,
    claimedIdentity: null,
    signals: {
      urgency: {
        name: "urgency" as const,
        score: 0.1,
        present: false,
        evidenceSpans: [],
        explanation: "No urgency detected.",
      },
      secrecy: {
        name: "secrecy" as const,
        score: 0.0,
        present: false,
        evidenceSpans: [],
        explanation: "No secrecy detected.",
      },
      payment: {
        name: "payment" as const,
        score: 0.0,
        present: false,
        evidenceSpans: [],
        explanation: "No payment detected.",
      },
      credentials: {
        name: "credentials" as const,
        score: 0.0,
        present: false,
        evidenceSpans: [],
        explanation: "No credentials detected.",
      },
      changed_contact: {
        name: "changed_contact" as const,
        score: 0.0,
        present: false,
        evidenceSpans: [],
        explanation: "No changed contact detected.",
      },
    },
    uncertainty: false,
    plainLanguageSummary: "Message appears benign.",
  };
}

describe("AnthropicEvidenceProvider", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.EVIDENCE_ANTHROPIC_API_KEY = "test-key";
    process.env.EVIDENCE_ANTHROPIC_MODEL = "claude-haiku-4-5-20251001";
    delete process.env.EVIDENCE_ANTHROPIC_TIMEOUT_MS;
  });

  it("returns parsed extraction and metadata on valid LLM output", async () => {
    const { generateText } = await import("ai");
    const mockGenerateText = vi.mocked(generateText);
    const validExtraction = makeValidExtraction();
    mockGenerateText.mockResolvedValue({
      text: JSON.stringify(validExtraction),
      usage: { totalTokens: 200, promptTokens: 150, completionTokens: 50 },
      finishReason: "stop",
      warnings: [],
      steps: [],
    } as never);

    const provider = new AnthropicEvidenceProvider();
    const result = await provider.extract({
      system: evidenceSystemInstruction,
      user: wrapUntrustedMessage("Hello, can you help me?"),
      requestId: "test-valid",
    });

    expect(result.extraction).toMatchObject({ schemaVersion: "1.0" });
    expect(result.metadata.provider).toBe("anthropic");
    expect(result.metadata.model).toBe("claude-haiku-4-5-20251001");
    expect(typeof result.metadata.estimatedCostUsd).toBe("number");
  });

  it("throws on malformed JSON response", async () => {
    const { generateText } = await import("ai");
    const mockGenerateText = vi.mocked(generateText);
    mockGenerateText.mockResolvedValue({
      text: "not valid json {{{}",
      usage: { totalTokens: 50, promptTokens: 40, completionTokens: 10 },
      finishReason: "stop",
      warnings: [],
      steps: [],
    } as never);

    const provider = new AnthropicEvidenceProvider();
    await expect(
      provider.extract({
        system: evidenceSystemInstruction,
        user: wrapUntrustedMessage("Wire me money."),
        requestId: "test-malformed",
      }),
    ).rejects.toThrow();
  });

  it("throws when Zod schema validation fails on out-of-range score", async () => {
    const { generateText } = await import("ai");
    const mockGenerateText = vi.mocked(generateText);
    const badExtraction = makeValidExtraction();
    // score must be in [0, 1]
    badExtraction.signals.urgency.score = 9.9;

    mockGenerateText.mockResolvedValue({
      text: JSON.stringify(badExtraction),
      usage: { totalTokens: 100, promptTokens: 80, completionTokens: 20 },
      finishReason: "stop",
      warnings: [],
      steps: [],
    } as never);

    const provider = new AnthropicEvidenceProvider();
    await expect(
      provider.extract({
        system: evidenceSystemInstruction,
        user: wrapUntrustedMessage("This is urgent!!!"),
        requestId: "test-out-of-range",
      }),
    ).rejects.toThrow();
  });

  it("throws when the request times out", async () => {
    const { generateText } = await import("ai");
    const mockGenerateText = vi.mocked(generateText);
    process.env.EVIDENCE_ANTHROPIC_TIMEOUT_MS = "1";
    mockGenerateText.mockImplementation(
      () =>
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error("The operation was aborted")), 50),
        ),
    );

    const provider = new AnthropicEvidenceProvider();
    await expect(
      provider.extract({
        system: evidenceSystemInstruction,
        user: wrapUntrustedMessage("This will timeout."),
        requestId: "test-timeout",
      }),
    ).rejects.toThrow();
  });

  it("re-throws on provider exception", async () => {
    const { generateText } = await import("ai");
    const mockGenerateText = vi.mocked(generateText);
    mockGenerateText.mockRejectedValue(new Error("Network failure"));

    const provider = new AnthropicEvidenceProvider();
    await expect(
      provider.extract({
        system: evidenceSystemInstruction,
        user: wrapUntrustedMessage("Send me the OTP."),
        requestId: "test-exception",
      }),
    ).rejects.toThrow("Network failure");
  });

  it("LlmEvidenceExtractor falls back to deterministic when AnthropicEvidenceProvider throws", async () => {
    const { generateText } = await import("ai");
    const mockGenerateText = vi.mocked(generateText);
    mockGenerateText.mockRejectedValue(new Error("API unavailable"));

    const provider = new AnthropicEvidenceProvider();
    const extractor = new LlmEvidenceExtractor(
      new FixtureEvidenceExtractor(),
      provider,
    );

    const result = await extractor.extract({
      text: "Buy gift cards right now.",
      requestId: "test-fallback",
    });

    expect(result.metadata?.fallbackUsed).toBe(true);
    expect(result.metadata?.provider).toBe("deterministic-fallback");
  });
});
