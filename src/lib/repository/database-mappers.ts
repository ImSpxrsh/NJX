import { z } from "zod";
import { evidenceExtractionSchema } from "@/lib/evidence/schema";
import type {
  CheckRecord,
  CheckState,
  HouseholdRecord,
  PhoneAlertRecord,
  PublicCheckRecord,
  StatusSource,
  TrustedContactRecord,
  VerificationRequestRecord,
} from "@/types/domain";
import type { Json, TableInsert } from "@/types/database";
import type { CheckCreationInput } from "./contracts";

const isoTimestamp = z.string().datetime({ offset: true });
const nullableTimestamp = isoTimestamp.nullable();
const checkState = z.enum([
  "RECEIVED",
  "PAUSED",
  "PENDING",
  "VERIFIED",
  "DENIED",
  "EXPIRED",
]);
const verificationLevel = z.enum(["L0", "L1", "L2", "L3"]);
const source = z.enum(["web", "phone"]);
const policyReasons = z.array(z.string().trim().max(500)).max(20);

function toJson(value: unknown): Json {
  return JSON.parse(JSON.stringify(value)) as Json;
}

export function toPausedCheckInsert(
  input: CheckCreationInput,
): TableInsert<"checks"> {
  const extraction = evidenceExtractionSchema.parse(input.extraction);
  const reasons = policyReasons.parse(input.decision.reasons);
  return {
    household_id: z.string().uuid().parse(input.householdId),
    source: source.parse(input.source),
    state: "PAUSED",
    verification_level: verificationLevel.parse(input.decision.level),
    sanitized_summary: z
      .string()
      .trim()
      .max(500)
      .parse(extraction.plainLanguageSummary),
    evidence_json: toJson(extraction),
    policy_reasons: toJson(reasons),
    expires_at: null,
  };
}

const checkRowSchema = z
  .object({
    id: z.string().uuid(),
    household_id: z.string().uuid(),
    source,
    state: checkState,
    verification_level: verificationLevel,
    sanitized_summary: z.string().max(500),
    evidence_json: z.unknown(),
    policy_reasons: z.unknown(),
    created_at: isoTimestamp,
    updated_at: isoTimestamp,
    expires_at: nullableTimestamp,
  })
  .strict();

function statusSourceFor(state: CheckState): StatusSource {
  if (state === "PENDING") return "NO_RESPONSE";
  if (state === "VERIFIED" || state === "DENIED") return "ENROLLED_CONTACT";
  if (state === "EXPIRED") return "SYSTEM_EXPIRY";
  return "POLICY_ENGINE";
}

export function mapCheckRow(row: unknown): CheckRecord {
  const parsed = checkRowSchema.parse(row);
  const extraction = evidenceExtractionSchema.parse(parsed.evidence_json);
  const reasons = policyReasons.parse(parsed.policy_reasons);
  return {
    id: parsed.id,
    householdId: parsed.household_id,
    source: parsed.source,
    state: parsed.state,
    verificationLevel: parsed.verification_level,
    sanitizedSummary: parsed.sanitized_summary,
    extraction,
    policyReasons: reasons,
    requestedAction: extraction.requestedAction,
    createdAt: parsed.created_at,
    updatedAt: parsed.updated_at,
    expiresAt: parsed.expires_at,
    statusSource: statusSourceFor(parsed.state),
  };
}

export function mapPublicCheckRow(row: unknown): PublicCheckRecord {
  const check = mapCheckRow(row);
  return {
    id: check.id,
    source: check.source,
    state: check.state,
    verificationLevel: check.verificationLevel,
    sanitizedSummary: check.sanitizedSummary,
    policyReasons: check.policyReasons,
    requestedAction: check.requestedAction,
    createdAt: check.createdAt,
    updatedAt: check.updatedAt,
    expiresAt: check.expiresAt,
    statusSource: check.statusSource,
    signals: check.extraction.signals,
  };
}

const householdRowSchema = z
  .object({
    id: z.string().uuid(),
    display_name: z.string().min(1).max(120),
    created_at: isoTimestamp,
  })
  .strict();

export function mapHouseholdRow(row: unknown): HouseholdRecord {
  const parsed = householdRowSchema.parse(row);
  return {
    id: parsed.id,
    displayName: parsed.display_name,
    createdAt: parsed.created_at,
  };
}

const trustedContactRowSchema = z
  .object({
    id: z.string().uuid(),
    household_id: z.string().uuid(),
    display_name: z.string().min(1).max(120),
    phone_e164: z.string().nullable(),
    email: z.string().nullable(),
    channel: z.enum(["sms", "email", "manual_demo"]),
    destination_verified_at: nullableTimestamp,
    created_at: isoTimestamp,
  })
  .strict()
  .refine((row) => row.phone_e164 !== null || row.email !== null, {
    message: "Trusted contact has no usable destination.",
  });

export function mapTrustedContactRow(row: unknown): TrustedContactRecord {
  const parsed = trustedContactRowSchema.parse(row);
  return {
    id: parsed.id,
    householdId: parsed.household_id,
    displayName: parsed.display_name,
    phoneE164: parsed.phone_e164,
    email: parsed.email,
    channel: parsed.channel,
    destinationVerifiedAt: parsed.destination_verified_at,
    createdAt: parsed.created_at,
  };
}

const verificationRequestRowSchema = z
  .object({
    id: z.string().uuid(),
    check_id: z.string().uuid(),
    trusted_contact_id: z.string().uuid(),
    token_hash: z.string().length(64),
    status: z.enum(["PENDING", "COMPLETED", "EXPIRED"]),
    response: z.enum(["CONFIRMED_MINE", "DENIED_MINE", "CALL_ME"]).nullable(),
    expires_at: isoTimestamp,
    used_at: nullableTimestamp,
    created_at: isoTimestamp,
    responded_at: nullableTimestamp,
  })
  .strict();

export function mapVerificationRequestRow(
  row: unknown,
): VerificationRequestRecord {
  const parsed = verificationRequestRowSchema.parse(row);
  return {
    id: parsed.id,
    checkId: parsed.check_id,
    trustedContactId: parsed.trusted_contact_id,
    tokenHash: parsed.token_hash,
    status: parsed.status,
    response: parsed.response,
    expiresAt: parsed.expires_at,
    usedAt: parsed.used_at,
    createdAt: parsed.created_at,
    respondedAt: parsed.responded_at,
  };
}

const phoneAlertRowSchema = z
  .object({
    id: z.string().uuid(),
    household_id: z.string().uuid(),
    check_id: z.string().uuid(),
    twilio_call_sid_hash: z.string().length(64),
    pressed_digit: z.literal("1"),
    created_at: isoTimestamp,
  })
  .strict();

export function mapPhoneAlertRow(row: unknown): PhoneAlertRecord {
  const parsed = phoneAlertRowSchema.parse(row);
  return {
    id: parsed.id,
    householdId: parsed.household_id,
    checkId: parsed.check_id,
    callSidHash: parsed.twilio_call_sid_hash,
    pressedDigit: parsed.pressed_digit,
    createdAt: parsed.created_at,
  };
}

const consumeVerificationResultSchema = z
  .object({
    result_state: z.enum(["PENDING", "VERIFIED", "DENIED"]),
    result_message: z.string().trim().min(1).max(200),
  })
  .strict();

export function mapConsumeVerificationTokenResult(row: unknown): {
  state: "PENDING" | "VERIFIED" | "DENIED";
  message: string;
} {
  const parsed = consumeVerificationResultSchema.parse(row);
  return {
    state: parsed.result_state,
    message: parsed.result_message,
  };
}
