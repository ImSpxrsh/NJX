import type { EvidenceExtractor } from "./extractor";
import type {
  EvidenceExtraction,
  EvidenceSignal,
  SignalName,
} from "@/types/domain";
import { evidenceExtractionSchema } from "./schema";

const terms: Record<SignalName, RegExp> = {
  urgency: /\b(today|immediately|urgent|right now|locked|emergency|hurry)\b/i,
  secrecy:
    /\b(do not call|don't call|keep (?:it )?secret|do not tell|between us)\b/i,
  payment: /\b(gift cards?|wire|bitcoin|crypto|send \$|money|payment|cash)\b/i,
  credentials:
    /\b(password|verification code|six-digit code|one-time code|otp|pin)\b/i,
  changed_contact:
    /\b(new number|lost my phone|call me here|changed (?:my )?(?:phone|number))\b/i,
};

const explanations: Record<SignalName, string> = {
  urgency: "The message pressures you to act quickly.",
  secrecy: "The message asks you to keep the request from someone else.",
  payment: "The message asks for money or another financial transfer.",
  credentials: "The message asks for a password or verification code.",
  changed_contact: "The message claims a changed or unfamiliar contact method.",
};

function makeSignal(name: SignalName, text: string): EvidenceSignal {
  const match = text.match(terms[name]);
  const present = Boolean(match);
  return {
    name,
    score: present ? (name === "changed_contact" ? 0.72 : 0.86) : 0.05,
    present,
    evidenceSpans: match ? [match[0].slice(0, 160)] : [],
    explanation: present
      ? explanations[name]
      : `No ${name.replace("_", " ")} warning sign was identified.`,
  };
}

export class FixtureEvidenceExtractor implements EvidenceExtractor {
  async extract({
    text,
  }: {
    text: string;
    requestId: string;
  }): Promise<EvidenceExtraction> {
    const normalized = text.trim().slice(0, 4_000);
    const signals = {
      urgency: makeSignal("urgency", normalized),
      secrecy: makeSignal("secrecy", normalized),
      payment: makeSignal("payment", normalized),
      credentials: makeSignal("credentials", normalized),
      changed_contact: makeSignal("changed_contact", normalized),
    };
    const present = Object.values(signals).filter((signal) => signal.present);
    const extraction: EvidenceExtraction = {
      schemaVersion: "1.0",
      requestedAction: signals.credentials.present
        ? "Share a password or verification code"
        : signals.payment.present
          ? "Send money or a financial equivalent"
          : signals.changed_contact.present
            ? "Use a changed contact method"
            : null,
      claimedIdentity: /\b(bank)\b/i.test(normalized)
        ? "A bank"
        : /\b(grandson|grandma)\b/i.test(normalized)
          ? "A family member"
          : null,
      signals,
      uncertainty: normalized.length === 0,
      plainLanguageSummary:
        present.length > 0
          ? `The request contains ${present.map((signal) => signal.name.replace("_", " ")).join(", ")} warning signs.`
          : normalized
            ? "No listed warning signs were identified, but unusual requests should still be checked."
            : "There was not enough message content to assess. Pause and verify through a known channel.",
    };
    return evidenceExtractionSchema.parse(extraction);
  }
}
