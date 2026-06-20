import { randomBytes, randomInt } from "node:crypto";
import { sha256 } from "./hashing";

/**
 * Enrollment destination verification (CC-202) uses token infrastructure that is
 * deliberately separate from request-verification tokens (`tokens.ts`).
 *
 * Separation is enforced two ways:
 *   1. Records live in a different table (`enrollment_verifications`).
 *   2. Secrets are hashed with a purpose-bound domain prefix, so an identical raw
 *      string hashed for one purpose never matches a hash stored for the other.
 *
 * As a result a request-verification token can never satisfy an enrollment check
 * and an enrollment secret can never satisfy a request-verification check, even
 * if the raw values were somehow identical.
 */
export const ENROLLMENT_PURPOSE = "circlecheck:enrollment-destination:v1";

export const ENROLLMENT_LINK_TOKEN_BYTES = 32;
export const ENROLLMENT_LINK_PATTERN = /^[A-Za-z0-9_-]{43}$/;

export const ENROLLMENT_CODE_DIGITS = 8;
export const ENROLLMENT_CODE_PATTERN = /^[0-9]{8}$/;

/**
 * Email enrollment uses a high-entropy (256-bit) link token. The record is
 * located by hashing the supplied token, so no contact identifier needs to
 * appear in the delivery URL.
 */
export function createEnrollmentLinkToken(): {
  rawToken: string;
  secretHash: string;
} {
  const rawToken = randomBytes(ENROLLMENT_LINK_TOKEN_BYTES).toString(
    "base64url",
  );
  return { rawToken, secretHash: hashEnrollmentLinkToken(rawToken) };
}

export function hashEnrollmentLinkToken(rawToken: string): string {
  return sha256(`${ENROLLMENT_PURPOSE}:link:${rawToken}`);
}

export function isValidEnrollmentLinkFormat(token: string): boolean {
  return ENROLLMENT_LINK_PATTERN.test(token);
}

/**
 * SMS enrollment uses a short numeric code for usability. A code is low entropy,
 * so it is always scoped to a specific contact in the hash and protected by
 * strict per-enrollment attempt limits and lockout. The contact id is mixed into
 * the hash so a code is meaningless without the matching enrollment context and
 * cannot be replayed against a different contact.
 */
export function createEnrollmentCode(contactId: string): {
  code: string;
  secretHash: string;
} {
  const code = secureNumericCode(ENROLLMENT_CODE_DIGITS);
  return { code, secretHash: hashEnrollmentCode(contactId, code) };
}

export function hashEnrollmentCode(contactId: string, code: string): string {
  return sha256(`${ENROLLMENT_PURPOSE}:code:${contactId}:${code}`);
}

export function isValidEnrollmentCodeFormat(code: string): boolean {
  return ENROLLMENT_CODE_PATTERN.test(code);
}

/** Unbiased CSPRNG numeric code. `randomInt` rejection-samples internally. */
function secureNumericCode(length: number): string {
  let out = "";
  for (let i = 0; i < length; i += 1) {
    out += randomInt(0, 10).toString();
  }
  return out;
}
