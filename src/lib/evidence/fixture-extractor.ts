import type { EvidenceExtractor } from "./extractor";
import type {
  EvidenceExtraction,
  EvidenceSignal,
  SignalName,
} from "@/types/domain";
import { evidenceExtractionSchema } from "./schema";
import {
  DETERMINISTIC_RULE_VERSION,
  EXTRACTION_SCHEMA_VERSION,
  PROMPT_VERSION,
} from "./versions";

const MAX_INPUT = 4_000;
const MAX_SPANS = 5;
const MAX_SPAN_LENGTH = 120;

type Rule = {
  id: string;
  signal: SignalName;
  score: number;
  pattern: RegExp;
  explanation: string;
};

const rules: Rule[] = [
  {
    id: "urgency-immediate",
    signal: "urgency",
    score: 0.86,
    pattern: /\b(urgent|immediately|right now|now|today|hurry|emergency|locked|final notice|last chance|asap)\b/giu,
    explanation: "The message pressures you to act quickly.",
  },
  {
    id: "secrecy-do-not-tell",
    signal: "secrecy",
    score: 0.86,
    pattern: /\b(do not tell|don't tell|keep (?:it )?secret|between us|do not call|don't call|no one else)\b/giu,
    explanation: "The message asks you to keep the request from someone else.",
  },
  {
    id: "payment-transfer",
    signal: "payment",
    score: 0.86,
    pattern: /\b(gift\s*cards?|prepaid cards?|wire|wire transfer|transfer funds?|funds?|money|zelle|venmo|cashapp|bitcoin|crypto|wallet|send money|payment|cash|bank transfer|western union|moneygram)\b|[$€£]\s?\d+/giu,
    explanation: "The message asks for money or another financial transfer.",
  },
  {
    id: "credentials-secret",
    signal: "credentials",
    score: 0.9,
    pattern: /\b(password|passcode|login code|bank code|verification code|security code|six[-\s]?digit code|one[-\s]?time code|otp|2fa|mfa|pin)\b/giu,
    explanation: "The message asks for a password or verification code.",
  },
  {
    id: "changed-contact",
    signal: "changed_contact",
    score: 0.74,
    pattern: /\b(new number|different phone|lost my phone|phone broke|call me here|text me here|changed (?:my )?(?:phone|number)|temporary number)\b/giu,
    explanation: "The message claims a changed or unfamiliar contact method.",
  },
];

const absentExplanations: Record<SignalName, string> = {
  urgency: "No urgency warning sign was identified.",
  secrecy: "No secrecy warning sign was identified.",
  payment: "No payment warning sign was identified.",
  credentials: "No credential or verification-code request was identified.",
  changed_contact: "No changed-contact warning sign was identified.",
};

function normalizeForRules(text: string): string {
  return text
    .normalize("NFKC")
    .replace(/[аàáâãäå]/giu, "a")
    .replace(/[р]/giu, "p")
    .replace(/[οо]/giu, "o")
    .replace(/[еèéêë]/giu, "e")
    .replace(/[\u200B-\u200D\uFEFF]/g, "")
    .replace(/[!！]{2,}/g, " urgent ")
    .replace(/0tp/giu, "otp")
    .replace(/c[o0]de/giu, "code")
    .replace(/pa[s$]{2}w[o0]rd/giu, "password");
}

function collectSpans(text: string, pattern: RegExp): string[] {
  const spans: string[] = [];
  pattern.lastIndex = 0;
  for (const match of text.matchAll(pattern)) {
    const span = match[0].trim().slice(0, MAX_SPAN_LENGTH);
    if (span && !spans.includes(span)) spans.push(span);
    if (spans.length >= MAX_SPANS) break;
  }
  return spans;
}

function makeSignal(name: SignalName, normalized: string) {
  const matchingRules = rules.filter((rule) => rule.signal === name);
  const matches = matchingRules
    .map((rule) => ({ rule, spans: collectSpans(normalized, rule.pattern) }))
    .filter((match) => match.spans.length > 0);
  const present = matches.length > 0;
  const score = present
    ? Math.max(...matches.map((match) => match.rule.score))
    : 0.05;
  const evidenceSpans = matches.flatMap((match) => match.spans).slice(0, MAX_SPANS);
  const ruleIds = matches.map((match) => match.rule.id);
  const explanation = present
    ? matches[0].rule.explanation
    : absentExplanations[name];
  const signal: EvidenceSignal = {
    name,
    score,
    present,
    evidenceSpans,
    explanation,
  };
  return { signal, ruleIds };
}

function requestedAction(signals: Record<SignalName, EvidenceSignal>): string | null {
  if (signals.credentials.present) return "Share a password or verification code";
  if (signals.payment.present) return "Send money or a financial equivalent";
  if (signals.changed_contact.present) return "Use a changed contact method";
  return null;
}

function claimedIdentity(text: string): string | null {
  if (/\b(bank|irs|government|social security|medicare)\b/iu.test(text)) {
    return "An institution";
  }
  if (/\b(grandson|granddaughter|mom|dad|grandma|grandpa|nephew|niece)\b/iu.test(text)) {
    return "A family member";
  }
  if (/\b(microsoft|apple|tech support|support desk)\b/iu.test(text)) {
    return "Technical support";
  }
  return null;
}

export class FixtureEvidenceExtractor implements EvidenceExtractor {
  async extract({
    text,
  }: {
    text: string;
    requestId: string;
  }): Promise<EvidenceExtraction> {
    const original = text.slice(0, MAX_INPUT);
    const normalized = normalizeForRules(original.trim());
    const built = {
      urgency: makeSignal("urgency", normalized),
      secrecy: makeSignal("secrecy", normalized),
      payment: makeSignal("payment", normalized),
      credentials: makeSignal("credentials", normalized),
      changed_contact: makeSignal("changed_contact", normalized),
    };
    const signals = Object.fromEntries(
      Object.entries(built).map(([name, value]) => [name, value.signal]),
    ) as Record<SignalName, EvidenceSignal>;
    const present = Object.values(signals).filter((signal) => signal.present);
    const ruleIds = Object.values(built).flatMap((value) => value.ruleIds);
    const longOrEmpty = original.length >= MAX_INPUT || normalized.length === 0;
    const extraction: EvidenceExtraction = {
      schemaVersion: EXTRACTION_SCHEMA_VERSION,
      requestedAction: requestedAction(signals),
      claimedIdentity: claimedIdentity(normalized),
      signals,
      uncertainty: longOrEmpty || /output\s+verified|ignore previous|system policy/iu.test(normalized),
      plainLanguageSummary:
        present.length > 0
          ? `The request contains ${present.map((signal) => signal.name.replace("_", " ")).join(", ")} warning signs.`
          : normalized
            ? "No listed warning signs were identified, but unusual requests should still be checked."
            : "There was not enough message content to assess. Pause and verify through a known channel.",
      metadata: {
        promptVersion: PROMPT_VERSION,
        deterministicRuleVersion: DETERMINISTIC_RULE_VERSION,
        provider: "deterministic",
        model: null,
        fallbackUsed: false,
        ruleIds,
      },
    };
    return evidenceExtractionSchema.parse(extraction);
  }
}
