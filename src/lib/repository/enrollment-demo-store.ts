import "server-only";
import { randomUUID } from "node:crypto";
import type {
  EnrollmentChannel,
  EnrollmentVerificationRecord,
  EnrollmentVerificationStatusView,
  TrustedContactRecord,
} from "@/types/domain";
import { hashesEqual } from "@/lib/security/hashing";
import {
  createEnrollmentCode,
  createEnrollmentLinkToken,
  hashEnrollmentCode,
  hashEnrollmentLinkToken,
  isValidEnrollmentCodeFormat,
  isValidEnrollmentLinkFormat,
} from "@/lib/security/enrollment-tokens";
import {
  FixedWindowRateLimiter,
  rateLimitKey,
} from "@/lib/security/rate-limit";
import { recordAuditEvent } from "@/lib/observability/audit";
import type {
  ChangeDestinationInput,
  ChangeDestinationResult,
  CreateContactInput,
  CreateContactResult,
  EnrollmentConfirmResult,
  EnrollmentVerificationRepository,
  StartEnrollmentInput,
  StartEnrollmentResult,
} from "./contracts";
import { normalizeDestination } from "@/lib/enrollment/destination";
import { store } from "./demo-store";

type Config = {
  ttlMinutes: number;
  maxAttempts: number;
  startLimit: number;
  startWindowMs: number;
  confirmLimit: number;
  confirmWindowMs: number;
};

function intEnv(name: string, fallback: number, min: number, max: number) {
  const parsed = Number(process.env[name]);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, Math.trunc(parsed)));
}

function getConfig(): Config {
  return {
    ttlMinutes: intEnv("ENROLLMENT_TOKEN_TTL_MINUTES", 15, 1, 1_440),
    maxAttempts: intEnv("ENROLLMENT_MAX_ATTEMPTS", 5, 1, 20),
    startLimit: intEnv("ENROLLMENT_START_LIMIT", 3, 1, 100),
    startWindowMs: intEnv(
      "ENROLLMENT_START_WINDOW_MS",
      600_000,
      1_000,
      86_400_000,
    ),
    confirmLimit: intEnv("ENROLLMENT_CONFIRM_LIMIT", 10, 1, 1_000),
    confirmWindowMs: intEnv(
      "ENROLLMENT_CONFIRM_WINDOW_MS",
      600_000,
      1_000,
      86_400_000,
    ),
  };
}

// Module-scoped limiters so abuse counters survive across repository instances
// but are rebuilt from current env on demo reset (test seam).
let startLimiter: FixedWindowRateLimiter | undefined;
let confirmLimiter: FixedWindowRateLimiter | undefined;

function getStartLimiter(): FixedWindowRateLimiter {
  if (!startLimiter) {
    const cfg = getConfig();
    startLimiter = new FixedWindowRateLimiter(
      cfg.startLimit,
      cfg.startWindowMs,
    );
  }
  return startLimiter;
}

function getConfirmLimiter(): FixedWindowRateLimiter {
  if (!confirmLimiter) {
    const cfg = getConfig();
    confirmLimiter = new FixedWindowRateLimiter(
      cfg.confirmLimit,
      cfg.confirmWindowMs,
    );
  }
  return confirmLimiter;
}

export function resetEnrollmentDemo(): void {
  store.enrollments.clear();
  startLimiter = undefined;
  confirmLimiter = undefined;
}

function contactChannel(
  contact: TrustedContactRecord,
): EnrollmentChannel | null {
  if (contact.channel === "sms" && contact.phoneE164) return "sms";
  if (contact.channel === "email" && contact.email) return "email";
  return null;
}

function destinationOf(
  contact: TrustedContactRecord,
  channel: EnrollmentChannel,
): string {
  return (channel === "sms" ? contact.phoneE164 : contact.email) ?? "";
}

function expirePending(trustedContactId: string): void {
  for (const record of store.enrollments.values()) {
    if (
      record.trustedContactId === trustedContactId &&
      record.status === "PENDING"
    ) {
      record.status = "EXPIRED";
    }
  }
}

function latestEnrollment(
  trustedContactId: string,
): EnrollmentVerificationRecord | null {
  let latest: EnrollmentVerificationRecord | null = null;
  for (const record of store.enrollments.values()) {
    if (record.trustedContactId !== trustedContactId) continue;
    if (!latest || record.createdAt > latest.createdAt) latest = record;
  }
  return latest;
}

function markContactVerified(record: EnrollmentVerificationRecord): void {
  const contact = store.contacts.get(record.trustedContactId);
  if (!contact) return;
  const now = new Date().toISOString();
  if (record.channel === "sms") {
    contact.phoneE164 = record.destination;
  } else {
    contact.email = record.destination;
  }
  contact.channel = record.channel;
  contact.destinationVerifiedAt = now;
}

/**
 * Resolve an active pending enrollment that has not expired. Lazily transitions
 * an expired record so reads stay consistent. Returns null for any state that
 * must be treated as a generic failure.
 */
function activePending(
  record: EnrollmentVerificationRecord | null,
): EnrollmentVerificationRecord | null {
  if (!record || record.status !== "PENDING") return null;
  if (Date.parse(record.expiresAt) <= Date.now()) {
    record.status = "EXPIRED";
    return null;
  }
  return record;
}

export function createEnrollmentDemoRepository(): EnrollmentVerificationRepository {
  return {
    async createContact(
      input: CreateContactInput,
    ): Promise<CreateContactResult> {
      const normalized = normalizeDestination(input.channel, input.destination);
      if (!normalized.ok) {
        return { ok: false, code: "INVALID_DESTINATION" };
      }
      const now = new Date().toISOString();
      const contact: TrustedContactRecord = {
        id: randomUUID(),
        householdId: input.householdId,
        displayName: input.displayName,
        phoneE164:
          normalized.destination.channel === "sms"
            ? normalized.destination.value
            : null,
        email:
          normalized.destination.channel === "email"
            ? normalized.destination.value
            : null,
        channel: normalized.destination.channel,
        // A submitted destination is never verified merely by being submitted.
        destinationVerifiedAt: null,
        createdAt: now,
      };
      store.contacts.set(contact.id, contact);
      recordAuditEvent({
        event: "enrollment.contact.create",
        outcome: "success",
        requestId: input.requestId,
        householdId: input.householdId,
        trustedContactId: contact.id,
        channel: normalized.destination.channel,
      });
      return { ok: true, contact: structuredClone(contact) };
    },

    async start(input: StartEnrollmentInput): Promise<StartEnrollmentResult> {
      const cfg = getConfig();
      const limiter = getStartLimiter();
      const limited =
        !limiter.check(rateLimitKey("enroll-start", input.householdId))
          .allowed ||
        !limiter.check(rateLimitKey("enroll-start", input.trustedContactId))
          .allowed;
      if (limited) {
        recordAuditEvent({
          event: "enrollment.verify.start",
          outcome: "rate_limited",
          requestId: input.requestId,
          householdId: input.householdId,
          trustedContactId: input.trustedContactId,
        });
        return { ok: false, code: "RATE_LIMITED" };
      }

      const contact = store.contacts.get(input.trustedContactId);
      // Cross-household access is indistinguishable from a missing contact.
      if (!contact || contact.householdId !== input.householdId) {
        return { ok: false, code: "CONTACT_NOT_FOUND" };
      }
      const channel = contactChannel(contact);
      const destination = channel ? destinationOf(contact, channel) : "";
      if (!channel || !destination) {
        return { ok: false, code: "INVALID_DESTINATION" };
      }

      // One active enrollment per contact: supersede any prior pending record.
      expirePending(contact.id);

      const now = Date.now();
      const id = randomUUID();
      let secretHash: string;
      let secret:
        | { kind: "code"; code: string }
        | { kind: "link"; rawToken: string };
      if (channel === "sms") {
        const { code, secretHash: hash } = createEnrollmentCode(contact.id);
        secretHash = hash;
        secret = { kind: "code", code };
      } else {
        const { rawToken, secretHash: hash } = createEnrollmentLinkToken();
        secretHash = hash;
        secret = { kind: "link", rawToken };
      }

      const record: EnrollmentVerificationRecord = {
        id,
        householdId: contact.householdId,
        trustedContactId: contact.id,
        channel,
        destination,
        secretHash,
        status: "PENDING",
        attemptCount: 0,
        maxAttempts: cfg.maxAttempts,
        resendCount: 0,
        expiresAt: new Date(now + cfg.ttlMinutes * 60_000).toISOString(),
        consumedAt: null,
        lastAttemptAt: null,
        createdAt: new Date(now).toISOString(),
      };
      store.enrollments.set(id, record);
      recordAuditEvent({
        event: "enrollment.verify.start",
        outcome: "success",
        requestId: input.requestId,
        householdId: contact.householdId,
        trustedContactId: contact.id,
        enrollmentId: id,
        channel,
      });
      return {
        ok: true,
        verificationId: id,
        channel,
        expiresAt: record.expiresAt,
        deliverySecret: secret,
      };
    },

    async confirmByToken(
      rawToken: string,
      factors,
    ): Promise<EnrollmentConfirmResult> {
      if (factors?.networkHint && !throttleConfirm(factors.networkHint)) {
        return { ok: false, code: "RATE_LIMITED" };
      }
      if (!isValidEnrollmentLinkFormat(rawToken)) {
        return { ok: false, code: "INVALID" };
      }
      const hash = hashEnrollmentLinkToken(rawToken);
      let match: EnrollmentVerificationRecord | null = null;
      for (const record of store.enrollments.values()) {
        if (
          record.channel === "email" &&
          hashesEqual(record.secretHash, hash)
        ) {
          match = record;
          break;
        }
      }
      const active = activePending(match);
      if (!active) {
        return { ok: false, code: "INVALID" };
      }
      active.status = "VERIFIED";
      active.consumedAt = new Date().toISOString();
      active.lastAttemptAt = active.consumedAt;
      markContactVerified(active);
      recordAuditEvent({
        event: "enrollment.verify.confirm",
        outcome: "success",
        householdId: active.householdId,
        trustedContactId: active.trustedContactId,
        enrollmentId: active.id,
        channel: "email",
      });
      return { ok: true, status: "VERIFIED" };
    },

    async confirmByCode(
      trustedContactId: string,
      code: string,
      factors,
    ): Promise<EnrollmentConfirmResult> {
      if (factors?.networkHint && !throttleConfirm(factors.networkHint)) {
        return { ok: false, code: "RATE_LIMITED" };
      }
      if (!isValidEnrollmentCodeFormat(code)) {
        return { ok: false, code: "INVALID" };
      }
      const record = latestEnrollment(trustedContactId);
      const active = activePending(
        record && record.channel === "sms" ? record : null,
      );
      if (!active) {
        return { ok: false, code: "INVALID" };
      }
      if (active.attemptCount >= active.maxAttempts) {
        active.status = "LOCKED";
        return { ok: false, code: "INVALID" };
      }
      active.lastAttemptAt = new Date().toISOString();
      const candidate = hashEnrollmentCode(trustedContactId, code);
      if (!hashesEqual(candidate, active.secretHash)) {
        active.attemptCount += 1;
        if (active.attemptCount >= active.maxAttempts) {
          active.status = "LOCKED";
        }
        recordAuditEvent({
          event: "enrollment.verify.confirm",
          outcome: "failure",
          householdId: active.householdId,
          trustedContactId,
          enrollmentId: active.id,
          channel: "sms",
          code: "mismatch",
          attemptCount: active.attemptCount,
        });
        return { ok: false, code: "INVALID" };
      }
      active.status = "VERIFIED";
      active.consumedAt = active.lastAttemptAt;
      markContactVerified(active);
      recordAuditEvent({
        event: "enrollment.verify.confirm",
        outcome: "success",
        householdId: active.householdId,
        trustedContactId,
        enrollmentId: active.id,
        channel: "sms",
      });
      return { ok: true, status: "VERIFIED" };
    },

    async getStatus(
      trustedContactId: string,
    ): Promise<EnrollmentVerificationStatusView | null> {
      const contact = store.contacts.get(trustedContactId);
      if (!contact) return null;
      const latest = latestEnrollment(trustedContactId);
      activePending(latest); // lazily expire for an accurate read
      const channel = contactChannel(contact) ?? latest?.channel ?? "email";
      return {
        trustedContactId,
        channel,
        status:
          latest?.status ??
          (contact.destinationVerifiedAt ? "VERIFIED" : "PENDING"),
        destinationVerified: contact.destinationVerifiedAt !== null,
        expiresAt: latest?.expiresAt ?? "",
      };
    },

    async changeDestination(
      input: ChangeDestinationInput,
    ): Promise<ChangeDestinationResult> {
      const contact = store.contacts.get(input.trustedContactId);
      if (!contact) return { ok: false, code: "CONTACT_NOT_FOUND" };
      const normalized = normalizeDestination(input.channel, input.destination);
      if (!normalized.ok) return { ok: false, code: "INVALID_DESTINATION" };

      contact.channel = normalized.destination.channel;
      if (normalized.destination.channel === "sms") {
        contact.phoneE164 = normalized.destination.value;
        contact.email = null;
      } else {
        contact.email = normalized.destination.value;
        contact.phoneE164 = null;
      }
      // Changing a destination always clears prior verification and invalidates
      // any in-flight enrollment secret for the old value.
      contact.destinationVerifiedAt = null;
      expirePending(contact.id);
      recordAuditEvent({
        event: "enrollment.destination.change",
        outcome: "success",
        requestId: input.requestId,
        householdId: contact.householdId,
        trustedContactId: contact.id,
        channel: normalized.destination.channel,
      });
      return { ok: true, contact: structuredClone(contact) };
    },
  };
}

function throttleConfirm(networkHint: string): boolean {
  return getConfirmLimiter().check(rateLimitKey("enroll-confirm", networkHint))
    .allowed;
}
