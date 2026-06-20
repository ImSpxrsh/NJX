import type { EnrollmentChannel } from "@/types/domain";

/**
 * Destination normalization for enrollment (CC-201/CC-202 boundary).
 *
 * These validators are intentionally conservative and dependency-free. They
 * normalize to a canonical form and reject clearly invalid input. They are not a
 * full E.164 carrier validation or a deliverability check; production may layer a
 * phone-number library and a deliverability probe on top (documented limitation).
 *
 * A normalized destination is never proof that the destination is reachable or
 * owned by the contact. Only completing the verification challenge establishes
 * that — see {@link EnrollmentChannel} flows.
 */
export type NormalizedDestination = {
  channel: EnrollmentChannel;
  value: string;
};

export type NormalizeResult =
  | { ok: true; destination: NormalizedDestination }
  | { ok: false; reason: "INVALID_PHONE" | "INVALID_EMAIL" };

// E.164: a leading "+", a nonzero country-code digit, then up to 14 more digits.
const E164_PATTERN = /^\+[1-9]\d{7,14}$/;
// Pragmatic single-address email shape. Deliberately rejects spaces, multiple
// "@", and missing TLD without attempting full RFC 5322 coverage.
const EMAIL_PATTERN = /^[^\s@]+@[^\s@.]+(?:\.[^\s@.]+)+$/;
const MAX_EMAIL_LENGTH = 254;

export function normalizePhoneE164(input: string): NormalizeResult {
  // Strip spaces, dashes, parentheses, and dots that humans add.
  const compact = input.trim().replace(/[\s().-]/g, "");
  if (!E164_PATTERN.test(compact)) {
    return { ok: false, reason: "INVALID_PHONE" };
  }
  return { ok: true, destination: { channel: "sms", value: compact } };
}

export function normalizeEmail(input: string): NormalizeResult {
  const lowered = input.trim().toLowerCase();
  if (lowered.length > MAX_EMAIL_LENGTH || !EMAIL_PATTERN.test(lowered)) {
    return { ok: false, reason: "INVALID_EMAIL" };
  }
  return { ok: true, destination: { channel: "email", value: lowered } };
}

export function normalizeDestination(
  channel: EnrollmentChannel,
  input: string,
): NormalizeResult {
  return channel === "sms" ? normalizePhoneE164(input) : normalizeEmail(input);
}
