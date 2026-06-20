import { describe, expect, it } from "vitest";
import { createVerificationToken } from "./tokens";
import { sha256 } from "./hashing";
import {
  createEnrollmentCode,
  createEnrollmentLinkToken,
  ENROLLMENT_CODE_DIGITS,
  hashEnrollmentCode,
  hashEnrollmentLinkToken,
  isValidEnrollmentCodeFormat,
  isValidEnrollmentLinkFormat,
} from "./enrollment-tokens";

describe("enrollment link tokens", () => {
  it("is high entropy, hashed at rest, and never echoes the raw value", () => {
    const { rawToken, secretHash } = createEnrollmentLinkToken();
    expect(isValidEnrollmentLinkFormat(rawToken)).toBe(true);
    expect(secretHash).toHaveLength(64);
    expect(secretHash).not.toContain(rawToken);
  });

  it("is domain-separated from request-verification tokens", () => {
    // Even for an identical raw string the two purposes produce different
    // hashes, so a request token can never satisfy an enrollment lookup.
    const { rawToken } = createVerificationToken();
    expect(hashEnrollmentLinkToken(rawToken)).not.toEqual(sha256(rawToken));
  });
});

describe("enrollment codes", () => {
  it("generates a fixed-length numeric code bound to the contact", () => {
    const contactId = "c-1";
    const { code, secretHash } = createEnrollmentCode(contactId);
    expect(isValidEnrollmentCodeFormat(code)).toBe(true);
    expect(code).toHaveLength(ENROLLMENT_CODE_DIGITS);
    expect(secretHash).toBe(hashEnrollmentCode(contactId, code));
  });

  it("binds the code hash to the contact id", () => {
    const { code } = createEnrollmentCode("contact-a");
    // The same code for a different contact hashes differently, preventing
    // replay of a code against another contact.
    expect(hashEnrollmentCode("contact-a", code)).not.toEqual(
      hashEnrollmentCode("contact-b", code),
    );
  });

  it("rejects malformed codes", () => {
    expect(isValidEnrollmentCodeFormat("1234567")).toBe(false);
    expect(isValidEnrollmentCodeFormat("abcdefgh")).toBe(false);
    expect(isValidEnrollmentCodeFormat("12345678")).toBe(true);
  });
});
