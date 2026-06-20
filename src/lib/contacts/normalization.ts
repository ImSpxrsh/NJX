// Pure normalization + validation for destination channels. No storage or
// framework dependencies, so it is trivially unit-testable and reusable.

import { parsePhoneNumberFromString } from "libphonenumber-js";
import { z } from "zod";
import { ContactError } from "./errors";

// National-format numbers without a country code are interpreted in this
// region. E.164 input ("+1...") is region-independent.
const DEFAULT_PHONE_REGION = "US";

/**
 * Normalize a phone number to E.164 or throw ContactError("VALIDATION").
 *
 * Rejects:
 *  - unparseable / invalid numbers (per libphonenumber metadata, not just shape)
 *  - extensions, e.g. "609-555-1212 ext 4" — an extension cannot be represented
 *    in E.164 and is ambiguous for an SMS/voice destination.
 *
 * "(609) 555-1212" -> "+16095551212"
 */
export function normalizePhone(raw: string): string {
  const candidate = raw.trim();
  if (!candidate) {
    throw new ContactError("VALIDATION", "Phone number must not be empty.");
  }

  // libphonenumber-js parses extension syntaxes and exposes `.ext`, but drops
  // it from E.164 formatting — which would silently corrupt the destination.
  // Reject any extension explicitly.
  const parsed = parsePhoneNumberFromString(candidate, DEFAULT_PHONE_REGION);
  if (!parsed || parsed.ext || !parsed.isValid()) {
    throw new ContactError("VALIDATION", "Enter a valid phone number.");
  }
  return parsed.number; // E.164
}

/**
 * Normalize an email or throw ContactError("VALIDATION").
 *
 * Trims whitespace and lowercases the whole address. The local part is
 * technically case-sensitive per RFC 5321, but every mainstream provider
 * treats it case-insensitively; lowercasing yields one canonical row and blocks
 * duplicate enrollment via case variation.
 *
 * "  Test@Example.COM " -> "test@example.com"
 */
export function normalizeEmail(raw: string): string {
  const candidate = raw.trim().toLowerCase();
  const result = z.string().email().safeParse(candidate);
  if (!result.success) {
    throw new ContactError("VALIDATION", "Enter a valid email address.");
  }
  return result.data;
}

// --- Request shape validation (Zod) ---------------------------------------
// `.strict()` rejects unknown fields. Crucially there is NO `householdId`,
// `verified*`, or `id` field anywhere here, so a client cannot supply ownership
// or verification state through any payload.

export const createContactSchema = z
  .object({
    displayName: z.string().trim().min(1).max(120),
    phone: z.string().trim().min(1).optional(),
    email: z.string().trim().min(1).optional(),
  })
  .strict()
  .refine((value) => Boolean(value.phone) || Boolean(value.email), {
    message: "Provide at least one of phone or email.",
  });

export const updateContactSchema = z
  .object({
    displayName: z.string().trim().min(1).max(120).optional(),
    phone: z.string().trim().min(1).nullable().optional(),
    email: z.string().trim().min(1).nullable().optional(),
  })
  .strict();

export const startVerificationSchema = z
  .object({
    channel: z.enum(["sms", "email"]),
  })
  .strict();

export const completeVerificationSchema = z
  .object({
    code: z.string().trim().min(1).max(12),
  })
  .strict();
