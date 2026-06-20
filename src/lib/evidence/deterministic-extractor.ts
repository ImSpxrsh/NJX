import "server-only";
import type { EvidenceExtraction, SignalName } from "@/types/domain";
import { evidenceExtractionSchema } from "./schema";
import {
  DETERMINISTIC_RULE_VERSION,
  EXTRACTION_SCHEMA_VERSION,
  PROMPT_VERSION,
} from "./versions";

// Rule-based deterministic evidence extractor.
// Each signal has keyword/phrase patterns and produces evidence spans.
// This is the safe fallback used when LLM extraction is unavailable or fails.

const MAX_INPUT = 4_000;
const MAX_SPANS = 5;
const MAX_SPAN_LENGTH = 160;
const MIN_WORDS_FOR_CERTAINTY = 3;

// Scores >= this threshold mark a signal as present.
// 0.3 is the floor so single low-weight keywords (weight=0.3) still trigger.
const PRESENCE_THRESHOLD = 0.3;

type Rule = {
  id: string;
  // Must NOT use /g flag at module level — patterns are cloned before use.
  pattern: RegExp;
  weight: number; // contribution to signal score [0,1]
};

type SignalRules = {
  name: SignalName;
  rules: Rule[];
  explanationTemplate: (score: number, spans: string[]) => string;
};

// Normalize Unicode lookalikes and collapse whitespace
function normalize(text: string): string {
  return text
    .normalize("NFKC")
    .replace(/[аàáâãäå]/giu, "a")
    .replace(/[р]/giu, "p")
    .replace(/[οо]/giu, "o")
    .replace(/[еèéêë]/giu, "e")
    .replace(/[​-‍﻿]/g, "")
    .replace(/[!！]{2,}/g, " urgent ")
    .replace(/0tp/giu, "otp")
    .replace(/c[o0]de/giu, "code")
    .replace(/pa[s$]{2}w[o0]rd/giu, "password")
    .replace(/[^\S\n]+/g, " ")
    .trim();
}

// Extract matching spans from text
function extractSpans(text: string, patterns: RegExp[]): string[] {
  const spans: string[] = [];
  for (const pattern of patterns) {
    const cloned = new RegExp(pattern.source, "giu");
    cloned.lastIndex = 0;
    for (const match of text.matchAll(cloned)) {
      const span = match[0].trim().slice(0, MAX_SPAN_LENGTH);
      if (span && !spans.includes(span)) spans.push(span);
      if (spans.length >= MAX_SPANS) return spans;
    }
  }
  return spans;
}

// Test a pattern safely (resets lastIndex before use)
function patternMatches(pattern: RegExp, text: string): boolean {
  const cloned = new RegExp(pattern.source, pattern.flags.replace("g", "") + "iu");
  return cloned.test(text);
}

const SIGNAL_RULES: SignalRules[] = [
  {
    name: "urgency",
    rules: [
      { id: "urgency-right-now", pattern: /\bright\s+now\b/, weight: 0.7 },
      { id: "urgency-asap", pattern: /\basap\b|\bas soon as possible\b/, weight: 0.6 },
      { id: "urgency-immediately", pattern: /\bimmediately\b|\burgent(?:ly)?\b/, weight: 0.6 },
      { id: "urgency-hurry", pattern: /\bhurry\b/, weight: 0.4 },
      { id: "urgency-time-running-out", pattern: /\bno time\b|\btime is running out\b/, weight: 0.7 },
      { id: "urgency-deadline", pattern: /\bdeadline\b/, weight: 0.4 },
      { id: "urgency-emergency", pattern: /\bemergency\b|\bcrisis\b/, weight: 0.7 },
      { id: "urgency-locked", pattern: /\blocked\b|\bfinal notice\b|\blast chance\b/, weight: 0.6 },
      { id: "urgency-today", pattern: /\btoday\b|\bnow\b/, weight: 0.3 },
      { id: "urgency-quick", pattern: /\bquick(?:ly)?\b|\bfast\b/, weight: 0.3 },
      { id: "urgency-caps-inject", pattern: /\bURGENT\b|!!+/, weight: 0.3 },
    ],
    explanationTemplate: (score, spans) =>
      score >= PRESENCE_THRESHOLD
        ? `The message pressures you to act quickly${spans.length ? `: "${spans[0]}"` : ""}.`
        : "No urgency warning sign was identified.",
  },
  {
    name: "secrecy",
    rules: [
      { id: "secrecy-dont-tell", pattern: /\bdon'?t tell\b|\bdo not tell\b/, weight: 0.8 },
      { id: "secrecy-keep-secret", pattern: /\bkeep (?:it |this )?(?:secret|quiet|between us)\b/, weight: 0.8 },
      { id: "secrecy-dont-call", pattern: /\bdon'?t call\b|\bdo not call\b|\bdon'?t contact\b/, weight: 0.6 },
      { id: "secrecy-between-us", pattern: /\bbetween us\b/, weight: 0.7 },
      { id: "secrecy-no-one-else", pattern: /\bno one else\b|\bno one should know\b/, weight: 0.7 },
      { id: "secrecy-dont-mention", pattern: /\bdon'?t mention\b|\bquiet about\b/, weight: 0.6 },
      { id: "secrecy-omit", pattern: /\bomit\b/, weight: 0.5 },
      { id: "secrecy-secret", pattern: /\bsecret\b/, weight: 0.5 },
    ],
    explanationTemplate: (score, spans) =>
      score >= PRESENCE_THRESHOLD
        ? `The message asks you to keep the request from someone else${spans.length ? `: "${spans[0]}"` : ""}.`
        : "No secrecy warning sign was identified.",
  },
  {
    name: "payment",
    rules: [
      { id: "payment-gift-card", pattern: /\bgift\s*cards?\b|\bprepaid cards?\b/, weight: 0.9 },
      { id: "payment-wire-transfer", pattern: /\bwire transfer\b|\bbank transfer\b/, weight: 0.9 },
      { id: "payment-wire", pattern: /\bwire\b/, weight: 0.7 },
      { id: "payment-crypto", pattern: /\bcrypto(?:currency)?\b|\bbitcoin\b|\bethereum\b|\bwallet\b/, weight: 0.8 },
      { id: "payment-western-union", pattern: /\bwestern union\b|\bmoneygram\b|\bmoney order\b/, weight: 0.8 },
      { id: "payment-send-money", pattern: /\bsend money\b|\bsend\s*(?:me\s*)?\$\d+/, weight: 0.8 },
      { id: "payment-transfer-funds", pattern: /\btransfer funds?\b|\btransfer cash\b/, weight: 0.7 },
      { id: "payment-apps", pattern: /\bzelle\b|\bvenmo\b|\bcash\s*app\b|\bcashapp\b/, weight: 0.7 },
      { id: "payment-routing", pattern: /\baccount number\b|\brouting number\b/, weight: 0.8 },
      { id: "payment-cash", pattern: /\bcash\b/, weight: 0.4 },
      { id: "payment-money", pattern: /\bmoney\b/, weight: 0.4 },
      { id: "payment-funds", pattern: /\bfunds?\b/, weight: 0.4 },
      { id: "payment-pay", pattern: /\bpay(?:ment)?\b/, weight: 0.3 },
    ],
    explanationTemplate: (score, spans) =>
      score >= PRESENCE_THRESHOLD
        ? `The message asks for money or another financial transfer${spans.length ? `: "${spans[0]}"` : ""}.`
        : "No payment warning sign was identified.",
  },
  {
    name: "credentials",
    rules: [
      { id: "cred-password", pattern: /\bpassword\b|\bpasscode\b/, weight: 0.9 },
      { id: "cred-otp", pattern: /\bone.?time.?(?:code|password|pin)\b|\botp\b/, weight: 0.9 },
      { id: "cred-verification-code", pattern: /\bverification code\b|\bsix.?digit code\b|\bsecurity code\b|\blog(?:in)? code\b|\bbank code\b/, weight: 0.9 },
      { id: "cred-ssn", pattern: /\bsocial security\b|\bssn\b/, weight: 0.95 },
      { id: "cred-pin", pattern: /\bpin\b/, weight: 0.7 },
      { id: "cred-2fa", pattern: /\b2fa\b|\bmfa\b/, weight: 0.85 },
      { id: "cred-login-details", pattern: /\blog(?:in|.?in)\b.*(?:information|credentials|details)\b/, weight: 0.8 },
    ],
    explanationTemplate: (score, spans) =>
      score >= PRESENCE_THRESHOLD
        ? `The message asks for a password or verification code${spans.length ? `: "${spans[0]}"` : ""}.`
        : "No credential or verification-code request was identified.",
  },
  {
    name: "changed_contact",
    rules: [
      { id: "changed-new-number", pattern: /\bnew number\b|\bnew phone\b/, weight: 0.8 },
      { id: "changed-different", pattern: /\bdifferent phone\b|\bchanged? (?:my )?(?:phone|number)\b/, weight: 0.8 },
      { id: "changed-lost", pattern: /\blost my phone\b|\bphone broke\b/, weight: 0.7 },
      { id: "changed-call-here", pattern: /\bcall me (?:here|at|on)\b|\btext me here\b/, weight: 0.6 },
      { id: "changed-temporary", pattern: /\btemporary number\b/, weight: 0.7 },
      { id: "changed-got-new", pattern: /\bI (?:got|have) a new (?:phone|number)\b/, weight: 0.75 },
      { id: "changed-old-number", pattern: /\bold (?:number|phone)\b|\bnumber.*\bunreliable\b|\bunreliable.*\bnumber\b/, weight: 0.6 },
    ],
    explanationTemplate: (score, spans) =>
      score >= PRESENCE_THRESHOLD
        ? `The message claims a changed or unfamiliar contact method${spans.length ? `: "${spans[0]}"` : ""}.`
        : "No changed-contact warning sign was identified.",
  },
];

function scoreSignal(
  text: string,
  rules: Rule[],
): { score: number; spans: string[]; ruleIds: string[] } {
  let totalWeight = 0;
  const matchedPatterns: RegExp[] = [];
  const matchedRuleIds: string[] = [];

  for (const rule of rules) {
    if (patternMatches(rule.pattern, text)) {
      totalWeight += rule.weight;
      matchedPatterns.push(rule.pattern);
      matchedRuleIds.push(rule.id);
    }
  }

  const score = Math.min(1, totalWeight);
  const spans = extractSpans(text, matchedPatterns);
  return {
    score: Math.round(score * 100) / 100,
    spans,
    ruleIds: matchedRuleIds,
  };
}

function generateSummary(
  signals: EvidenceExtraction["signals"],
  normalized: string,
): string {
  const present = Object.values(signals).filter((s) => s.present);
  if (present.length === 0) {
    if (!normalized) {
      return "There was not enough message content to assess. Pause and verify through a known channel.";
    }
    return "No listed warning signs were identified, but unusual requests should still be checked.";
  }
  const names = present.map((s) => s.name.replace("_", " "));
  return `The request contains ${names.join(", ")} warning signs.`;
}

function extractRequestedAction(
  signals: EvidenceExtraction["signals"],
): string | null {
  if (signals.credentials.present) return "Share a password or verification code";
  if (signals.payment.present) return "Send money or a financial equivalent";
  if (signals.changed_contact.present) return "Use a changed contact method";
  return null;
}

function extractClaimedIdentity(text: string): string | null {
  if (/\b(bank|irs|government|social security|medicare)\b/iu.test(text)) {
    return "An institution";
  }
  if (
    /\b(grandson|granddaughter|mom|dad|grandma|grandpa|nephew|niece)\b/iu.test(
      text,
    )
  ) {
    return "A family member";
  }
  if (/\b(microsoft|apple|tech support|support desk)\b/iu.test(text)) {
    return "Technical support";
  }
  return null;
}

export class DeterministicEvidenceExtractor {
  readonly version = "deterministic-v1";

  async extract(input: {
    text: string;
    requestId: string;
  }): Promise<EvidenceExtraction> {
    // Treat input as untrusted data — never evaluate as code or instructions.
    // Cap input length to prevent resource exhaustion.
    const original = input.text.slice(0, MAX_INPUT);
    const normalized = normalize(original);

    const allRuleIds: string[] = [];
    const signals = {} as EvidenceExtraction["signals"];

    for (const signalDef of SIGNAL_RULES) {
      const { score, spans, ruleIds } = scoreSignal(normalized, signalDef.rules);
      const present = score >= PRESENCE_THRESHOLD;
      allRuleIds.push(...ruleIds);
      signals[signalDef.name] = {
        name: signalDef.name,
        score: present ? score : 0.05,
        present,
        evidenceSpans: spans,
        explanation: signalDef.explanationTemplate(score, spans),
      };
    }

    // Uncertainty: empty content, maxed-out input, very short messages,
    // or prompt injection patterns
    const wordCount = normalized.trim().split(/\s+/).filter(Boolean).length;
    const longOrEmpty = original.length >= MAX_INPUT || normalized.length === 0;
    const tooShort = wordCount > 0 && wordCount < MIN_WORDS_FOR_CERTAINTY;
    const uncertainty =
      longOrEmpty ||
      tooShort ||
      /output\s+verified|ignore previous|system policy/iu.test(normalized);

    const extraction: EvidenceExtraction = {
      schemaVersion: EXTRACTION_SCHEMA_VERSION,
      requestedAction: extractRequestedAction(signals),
      claimedIdentity: extractClaimedIdentity(normalized),
      signals,
      uncertainty,
      plainLanguageSummary: generateSummary(signals, normalized),
      metadata: {
        promptVersion: PROMPT_VERSION,
        deterministicRuleVersion: DETERMINISTIC_RULE_VERSION,
        provider: "deterministic",
        model: null,
        fallbackUsed: false,
        ruleIds: allRuleIds,
      },
    };

    return evidenceExtractionSchema.parse(extraction);
  }
}
