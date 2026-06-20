import { describe, expect, it } from "vitest";
import { evalCases, EVAL_DATASET_VERSION } from "../../evals/cases";
import { FixtureEvidenceExtractor } from "@/lib/evidence/fixture-extractor";
import { evaluatePolicy } from "@/lib/policy/evaluate-policy";
import { evidenceExtractionSchema } from "@/lib/evidence/schema";
import {
  DETERMINISTIC_RULE_VERSION,
  EXTRACTION_SCHEMA_VERSION,
  PROMPT_VERSION,
} from "@/lib/evidence/versions";
import type { SignalName, VerificationLevel } from "@/types/domain";

const levels: VerificationLevel[] = ["L0", "L1", "L2", "L3"];
const signals: SignalName[] = [
  "urgency",
  "secrecy",
  "payment",
  "credentials",
  "changed_contact",
];

function percentile(values: number[], p: number): number {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * p))] ?? 0;
}

describe("evidence extraction evaluation", () => {
  it("meets release gates for the versioned synthetic dataset", async () => {
    const extractor = new FixtureEvidenceExtractor();
    const latency: number[] = [];
    const counts = Object.fromEntries(
      signals.map((signal) => [
        signal,
        { tp: 0, fp: 0, fn: 0 },
      ]),
    ) as Record<SignalName, { tp: number; fp: number; fn: number }>;
    let schemaValid = 0;
    let fallback = 0;
    let minimumLevelViolations = 0;
    const minimumLevelViolationIds: string[] = [];
    let credentialFalseNegatives = 0;
    const credentialFalseNegativeIds: string[] = [];
    let paymentClusterFalseNegatives = 0;
    const paymentClusterFalseNegativeIds: string[] = [];
    const ordinaryEscalation: Record<string, number> = {};

    for (const item of evalCases) {
      const start = performance.now();
      const extraction = await extractor.extract({
        text: item.text,
        requestId: item.id,
      });
      latency.push(performance.now() - start);
      evidenceExtractionSchema.parse(extraction);
      schemaValid += 1;
      if (extraction.metadata?.fallbackUsed) fallback += 1;
      const decision = evaluatePolicy(extraction);
      if (levels.indexOf(decision.level) < levels.indexOf(item.minimumLevel)) {
        minimumLevelViolations += 1;
        minimumLevelViolationIds.push(`${item.id}:${decision.level}<${item.minimumLevel}`);
      }
      for (const signal of signals) {
        const expected = item.expectedPresentSignals.includes(signal);
        const actual = extraction.signals[signal].present;
        if (expected && actual) counts[signal].tp += 1;
        if (!expected && actual) counts[signal].fp += 1;
        if (expected && !actual) counts[signal].fn += 1;
      }
      if (
        item.expectedPresentSignals.includes("credentials") &&
        !extraction.signals.credentials.present
      ) {
        credentialFalseNegatives += 1;
        credentialFalseNegativeIds.push(item.id);
      }
      if (
        item.expectedPresentSignals.includes("payment") &&
        (item.expectedPresentSignals.includes("urgency") ||
          item.expectedPresentSignals.includes("secrecy") ||
          item.expectedPresentSignals.includes("changed_contact")) &&
        (!extraction.signals.payment.present ||
          !(
            extraction.signals.urgency.present ||
            extraction.signals.secrecy.present ||
            extraction.signals.changed_contact.present
          ))
      ) {
        paymentClusterFalseNegatives += 1;
        paymentClusterFalseNegativeIds.push(item.id);
      }
      if (item.tags.includes("ordinary")) {
        ordinaryEscalation[decision.level] =
          (ordinaryEscalation[decision.level] ?? 0) + 1;
      }
      expect(Object.keys(extraction)).not.toContain("verified");
      expect(Object.keys(extraction)).not.toContain("denied");
    }

    const report = {
      name: "evidence extraction evaluation",
      datasetVersion: EVAL_DATASET_VERSION,
      versions: {
        extractionSchema: EXTRACTION_SCHEMA_VERSION,
        prompt: PROMPT_VERSION,
        deterministicRules: DETERMINISTIC_RULE_VERSION,
      },
      totalCases: evalCases.length,
      perSignal: Object.fromEntries(
        signals.map((signal) => {
          const count = counts[signal];
          return [
            signal,
            {
              precision: count.tp / Math.max(1, count.tp + count.fp),
              recall: count.tp / Math.max(1, count.tp + count.fn),
            },
          ];
        }),
      ),
      credentialFalseNegatives,
      credentialFalseNegativeIds,
      paymentClusterFalseNegatives,
      paymentClusterFalseNegativeIds,
      schemaValidOutputRate: schemaValid / evalCases.length,
      fallbackRate: fallback / evalCases.length,
      minimumLevelViolations,
      minimumLevelViolationIds,
      ordinaryEscalation,
      latencyMs: {
        p50: percentile(latency, 0.5),
        p95: percentile(latency, 0.95),
      },
      estimatedCostPer100CasesUsd: 0,
    };

    console.info(JSON.stringify(report, null, 2));
    expect(evalCases).toHaveLength(110);
    expect(minimumLevelViolations).toBe(0);
    expect(credentialFalseNegatives).toBe(0);
    expect(paymentClusterFalseNegatives).toBe(0);
    expect(schemaValid).toBe(evalCases.length);
  });
});
