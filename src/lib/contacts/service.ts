import "server-only";
import type { z } from "zod";
import { getRepositories } from "@/lib/repository/factory";
import type {
  StartDestinationVerificationResponse,
  TrustedContactResponse,
} from "@/types/api";
import type {
  DestinationVerificationChannel,
  TrustedContactRecord,
} from "@/types/domain";
import { codeMatchesHash, createDestinationCode } from "./codes";
import { ContactError } from "./errors";
import { contactLimits } from "./limits";
import {
  createContactSchema,
  normalizeEmail,
  normalizePhone,
  updateContactSchema,
} from "./normalization";
import { deliverDestinationCode } from "@/lib/notifications/destination-otp";

function isDemoMode(): boolean {
  return process.env.CIRCLECHECK_REPOSITORY_MODE === "demo";
}

// Public-safe projection. Never exposes householdId, code hashes, or raw codes.
function toResponse(contact: TrustedContactRecord): TrustedContactResponse {
  return {
    id: contact.id,
    displayName: contact.displayName,
    phone: contact.phoneE164,
    email: contact.email,
    channel: contact.channel,
    verified: contact.destinationVerifiedAt !== null,
    verifiedAt: contact.destinationVerifiedAt,
    verifiedChannel: contact.destinationVerifiedChannel,
    createdAt: contact.createdAt,
    updatedAt: contact.updatedAt,
  };
}

// Preferred delivery channel for a contact. Distinct from verification channel.
// Prefers SMS when a phone is present, otherwise email.
function deriveChannel(phoneE164: string | null): "sms" | "email" {
  return phoneE164 ? "sms" : "email";
}

/**
 * Load a contact and enforce household ownership. Fails closed:
 *  - missing id            -> 404 NOT_FOUND
 *  - other household's id   -> 403 FORBIDDEN (never silently acts)
 */
async function loadOwned(
  householdId: string,
  id: string,
): Promise<TrustedContactRecord> {
  const contact = await getRepositories().trustedContacts.getInternalById(id);
  if (!contact) {
    throw new ContactError("NOT_FOUND", "Destination not found.");
  }
  if (contact.householdId !== householdId) {
    throw new ContactError(
      "FORBIDDEN",
      "Destination belongs to another household.",
    );
  }
  return contact;
}

export async function enrollContact(
  householdId: string,
  input: z.infer<typeof createContactSchema>,
): Promise<TrustedContactResponse> {
  const repos = getRepositories();

  // Spam prevention: per-household destination cap.
  const count = await repos.trustedContacts.countForHousehold(householdId);
  if (count >= contactLimits.maxDestinationsPerHousehold()) {
    throw new ContactError(
      "LIMIT_EXCEEDED",
      "This household has reached its maximum number of destinations.",
    );
  }

  const phoneE164 = input.phone ? normalizePhone(input.phone) : null;
  const email = input.email ? normalizeEmail(input.email) : null;
  if (!phoneE164 && !email) {
    throw new ContactError(
      "VALIDATION",
      "Provide at least one of phone or email.",
    );
  }

  const created = await repos.trustedContacts.create({
    householdId, // server-assigned ownership ONLY
    displayName: input.displayName,
    phoneE164,
    email,
    channel: deriveChannel(phoneE164),
  });
  return toResponse(created);
}

export async function listContacts(
  householdId: string,
): Promise<TrustedContactResponse[]> {
  const contacts =
    await getRepositories().trustedContacts.listForHousehold(householdId);
  return contacts.map(toResponse);
}

export async function getContact(
  householdId: string,
  id: string,
): Promise<TrustedContactResponse> {
  return toResponse(await loadOwned(householdId, id));
}

export async function updateContact(
  householdId: string,
  id: string,
  input: z.infer<typeof updateContactSchema>,
): Promise<TrustedContactResponse> {
  const existing = await loadOwned(householdId, id);

  // Merge: undefined keeps the existing value; null clears the channel; a
  // string is re-normalized. Existing channel values are already canonical.
  const phoneE164 =
    input.phone === undefined
      ? existing.phoneE164
      : input.phone === null
        ? null
        : normalizePhone(input.phone);
  const email =
    input.email === undefined
      ? existing.email
      : input.email === null
        ? null
        : normalizeEmail(input.email);
  if (!phoneE164 && !email) {
    throw new ContactError(
      "VALIDATION",
      "A destination must keep at least one of phone or email.",
    );
  }

  // repo.update clears verification state at the storage boundary.
  const updated = await getRepositories().trustedContacts.update(id, {
    displayName: input.displayName ?? existing.displayName,
    phoneE164,
    email,
    channel: deriveChannel(phoneE164),
  });
  return toResponse(updated);
}

export async function removeContact(
  householdId: string,
  id: string,
): Promise<void> {
  await loadOwned(householdId, id);
  await getRepositories().trustedContacts.remove(id);
}

function destinationForChannel(
  contact: TrustedContactRecord,
  channel: DestinationVerificationChannel,
): string {
  const value = channel === "sms" ? contact.phoneE164 : contact.email;
  if (!value) {
    throw new ContactError(
      "VALIDATION",
      `Destination has no ${channel === "sms" ? "phone" : "email"} to verify.`,
    );
  }
  return value;
}

export async function startDestinationVerification(
  householdId: string,
  id: string,
  channel: DestinationVerificationChannel,
): Promise<StartDestinationVerificationResponse> {
  const contact = await loadOwned(householdId, id);
  const destination = destinationForChannel(contact, channel);
  const repos = getRepositories();

  // Rate limit verification starts per household per rolling window.
  const since = new Date(
    Date.now() - contactLimits.verificationStartWindowMs(),
  ).toISOString();
  const recentStarts = await repos.contactVerifications.countStartsSince(
    householdId,
    since,
  );
  if (recentStarts >= contactLimits.maxVerificationStartsPerWindow()) {
    throw new ContactError(
      "LIMIT_EXCEEDED",
      "Too many verification attempts. Try again later.",
    );
  }

  const { code, codeHash } = createDestinationCode(
    contactLimits.verificationCodeLength(),
  );
  const expiresAt = new Date(
    Date.now() + contactLimits.verificationCodeTtlMs(),
  ).toISOString();
  const challenge = await repos.contactVerifications.createChallenge({
    trustedContactId: contact.id,
    householdId,
    channel,
    codeHash,
    expiresAt,
  });

  if (isDemoMode()) {
    // Labeled hackathon delivery channel (mirrors analyze's demoContactUrl).
    return {
      verificationId: challenge.id,
      channel,
      expiresAt,
      demoCode: code,
    };
  }

  const delivery = await deliverDestinationCode({ channel, destination, code });
  if (!delivery.delivered) {
    // Fail closed: never report success if the code could not be delivered.
    throw new ContactError(
      "CONFLICT",
      "Unable to deliver the verification code right now.",
    );
  }
  return { verificationId: challenge.id, channel, expiresAt };
}

export async function completeDestinationVerification(
  householdId: string,
  id: string,
  code: string,
): Promise<TrustedContactResponse> {
  const contact = await loadOwned(householdId, id);
  const repos = getRepositories();
  const challenge = await repos.contactVerifications.getActiveChallenge(
    contact.id,
  );
  if (!challenge) {
    throw new ContactError(
      "VERIFICATION_FAILED",
      "No active verification challenge.",
    );
  }

  if (Date.parse(challenge.expiresAt) <= Date.now()) {
    await repos.contactVerifications.expireChallenge(challenge.id);
    throw new ContactError("VERIFICATION_FAILED", "Verification code expired.");
  }

  // Brute-force guard: cap submissions per challenge.
  if (
    challenge.attempts >= contactLimits.maxVerificationAttemptsPerChallenge()
  ) {
    await repos.contactVerifications.expireChallenge(challenge.id);
    throw new ContactError(
      "LIMIT_EXCEEDED",
      "Too many incorrect attempts. Start verification again.",
    );
  }

  if (!codeMatchesHash(code, challenge.codeHash)) {
    await repos.contactVerifications.registerFailedAttempt(challenge.id);
    throw new ContactError("VERIFICATION_FAILED", "Invalid verification code.");
  }

  // Success: the only sanctioned path to a verified destination.
  const verified = await repos.contactVerifications.completeChallenge({
    challengeId: challenge.id,
    trustedContactId: contact.id,
    channel: challenge.channel,
    verifiedAt: new Date().toISOString(),
  });
  return toResponse(verified);
}

/**
 * High-trust gate. A high-trust workflow may only target an already-verified
 * destination. Rejects unverified destinations (fails closed).
 */
export async function assertHighTrustEligible(
  householdId: string,
  id: string,
): Promise<TrustedContactResponse> {
  const contact = await loadOwned(householdId, id);
  if (contact.destinationVerifiedAt === null) {
    throw new ContactError(
      "FORBIDDEN",
      "High-trust verification requires a verified destination.",
    );
  }
  return toResponse(contact);
}
