#!/usr/bin/env node
import { DeterministicEvidenceExtractor } from "../src/lib/evidence/deterministic-extractor";
import { evaluatePolicy } from "../src/lib/policy/evaluate-policy";
import { evalCases } from "./cases/index";
import type { SignalName } from "../src/types/domain";

const extractor = new DeterministicEvidenceExtractor();

type SignalMetrics = {
  truePositives: number;
  falsePositives: number;
  trueNegatives: number;
  falseNegatives: number;
};

const signalMetrics: Record<SignalName, SignalMetrics> = {
  urgency: {
    truePositives: 0,
    falsePositives: 0,
    trueNegatives: 0,
    falseNegatives: 0,
  },
  secrecy: {
    truePositives: 0,
    falsePositives: 0,
    trueNegatives: 0,
    falseNegatives: 0,
  },
  payment: {
    truePositives: 0,
    falsePositives: 0,
    trueNegatives: 0,
    falseNegatives: 0,
  },
  credentials: {
    truePositives: 0,
    falsePositives: 0,
    trueNegatives: 0,
    falseNegatives: 0,
  },
  changed_contact: {
    truePositives: 0,
    falsePositives: 0,
    trueNegatives: 0,
    falseNegatives: 0,
  },
};

let minimumLevelViolations = 0;
let schemaFailures = 0;
const totalCases = evalCases.length;

const levels = ["L0", "L1", "L2", "L3"] as const;

async function main() {
  console.log(`\nCircleCheck Evidence Evaluation Harness`);
  console.log(`Extractor: ${extractor.version}`);
  console.log(`Cases: ${totalCases}\n`);

  for (const evalCase of evalCases) {
    let extraction;
    try {
      extraction = await extractor.extract({
        text: evalCase.text,
        requestId: evalCase.id,
      });
    } catch (e) {
      schemaFailures++;
      console.error(
        `SCHEMA FAILURE [${evalCase.id}]: ${e instanceof Error ? e.message : String(e)}`,
      );
      continue;
    }

    const policy = evaluatePolicy(extraction);

    // Check minimum level
    if (levels.indexOf(policy.level) < levels.indexOf(evalCase.minimumLevel)) {
      minimumLevelViolations++;
      console.warn(
        `LEVEL VIOLATION [${evalCase.id}]: expected >=${evalCase.minimumLevel}, got ${policy.level}`,
      );
      console.warn(`  Text: "${evalCase.text.slice(0, 80)}..."`);
    }

    // Per-signal metrics
    for (const signalName of Object.keys(signalMetrics) as SignalName[]) {
      const signal = extraction.signals[signalName];
      const expectedPresent =
        evalCase.expectedPresentSignals.includes(signalName);
      const expectedAbsent =
        evalCase.expectedAbsentSignals.includes(signalName);
      const actual = signal.present;

      if (expectedPresent && actual) signalMetrics[signalName].truePositives++;
      else if (expectedPresent && !actual)
        signalMetrics[signalName].falseNegatives++;
      else if (expectedAbsent && actual)
        signalMetrics[signalName].falsePositives++;
      else if (expectedAbsent && !actual)
        signalMetrics[signalName].trueNegatives++;
    }
  }

  // Print metrics
  console.log("=== Signal Metrics ===");
  for (const [name, m] of Object.entries(signalMetrics) as [
    SignalName,
    SignalMetrics,
  ][]) {
    const precision =
      m.truePositives / (m.truePositives + m.falsePositives) || 0;
    const recall = m.truePositives / (m.truePositives + m.falseNegatives) || 0;
    console.log(
      `${name.padEnd(20)} P=${(precision * 100).toFixed(1)}%  R=${(recall * 100).toFixed(1)}%  TP=${m.truePositives}  FP=${m.falsePositives}  FN=${m.falseNegatives}`,
    );
  }

  console.log("\n=== Summary ===");
  console.log(`Total cases: ${totalCases}`);
  console.log(`Minimum level violations: ${minimumLevelViolations}`);
  console.log(`Schema failures: ${schemaFailures}`);

  if (minimumLevelViolations > 0 || schemaFailures > 0) {
    console.error("\nEvaluation failed: violations detected.");
    process.exit(1);
  } else {
    console.log("\nAll release gates passed.");
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
