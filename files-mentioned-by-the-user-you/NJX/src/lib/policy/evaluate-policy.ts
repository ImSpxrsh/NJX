import type { EvidenceExtraction, PolicyDecision } from "@/types/domain";
import { policyWeights } from "./levels";

function score(extraction: EvidenceExtraction): number {
  const s = extraction.signals;
  const z =
    policyWeights.bias +
    policyWeights.urgency * s.urgency.score +
    policyWeights.secrecy * s.secrecy.score +
    policyWeights.payment * s.payment.score +
    policyWeights.credentials * s.credentials.score +
    policyWeights.changed_contact * s.changed_contact.score;
  return Number((1 / (1 + Math.exp(-z))).toFixed(3));
}

export function evaluatePolicy(extraction: EvidenceExtraction): PolicyDecision {
  const { urgency, secrecy, payment, credentials, changed_contact } =
    extraction.signals;
  const all = Object.values(extraction.signals);
  const maxSignalScore = Math.max(...all.map((signal) => signal.score));
  const mediumCount = all.filter((signal) => signal.score >= 0.5).length;
  const policyScore = score(extraction);
  const reasons = all
    .filter((signal) => signal.present)
    .map((signal) => signal.explanation);

  if (
    credentials.present ||
    (payment.present &&
      (urgency.present || secrecy.present || changed_contact.present))
  ) {
    return {
      level: "L3",
      verificationRequired: true,
      reasons,
      requiredAction: "MANDATORY_HOLD_AND_VERIFY",
      policyScore,
    };
  }
  if (maxSignalScore >= 0.7 || mediumCount >= 2) {
    return {
      level: "L2",
      verificationRequired: true,
      reasons,
      requiredAction: "TRUSTED_CONTACT_CONFIRMATION",
      policyScore,
    };
  }
  if (changed_contact.present || extraction.uncertainty) {
    return {
      level: "L1",
      verificationRequired: false,
      reasons:
        reasons.length > 0
          ? reasons
          : ["The message could not be assessed reliably."],
      requiredAction: "KNOWN_NUMBER_CALLBACK",
      policyScore,
    };
  }
  return {
    level: "L0",
    verificationRequired: false,
    reasons: ["No listed warning signs were identified."],
    requiredAction: "NONE",
    policyScore,
  };
}
