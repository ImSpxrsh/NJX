import type {
  CheckRecord,
  EnrollmentChannel,
  EnrollmentVerificationStatusView,
  EvidenceExtraction,
  HouseholdRecord,
  PhoneAlertRecord,
  PolicyDecision,
  PublicCheckRecord,
  TrustedContactRecord,
  VerificationRequestRecord,
  VerificationResponse,
} from "@/types/domain";

export type CheckCreationInput = {
  householdId: string;
  source: "web" | "phone";
  extraction: EvidenceExtraction;
  decision: PolicyDecision;
};

export type CreatedVerification = {
  requestId: string;
  expiresAt: string;
  rawToken?: string;
};

export type CheckCreationResult = {
  check: PublicCheckRecord;
  verification?: CreatedVerification;
};

export interface CheckRepository {
  create(input: CheckCreationInput): Promise<CheckCreationResult>;
  getPublicById(id: string): Promise<PublicCheckRecord | null>;
  getInternalById(id: string): Promise<CheckRecord | null>;
}

export interface TrustedContactRepository {
  getInternalById(id: string): Promise<TrustedContactRecord | null>;
  getVerifiedForHousehold(
    householdId: string,
  ): Promise<TrustedContactRecord | null>;
}

export type VerificationContext = {
  state: "PENDING" | "COMPLETED" | "EXPIRED";
  summary: string;
  requestedAction: string | null;
  createdAt: string;
  expiresAt: string;
};

export type VerificationResponseResult =
  | {
      ok: true;
      state: "PENDING" | "VERIFIED" | "DENIED";
      message: string;
    }
  | {
      ok: false;
      code: "INVALID_TOKEN" | "UNKNOWN_TOKEN" | "ALREADY_USED" | "EXPIRED";
    };

export interface VerificationRequestRepository {
  getContext(rawToken: string): Promise<VerificationContext | null>;
  respond(
    rawToken: string,
    response: VerificationResponse,
  ): Promise<VerificationResponseResult>;
  getInternalById(id: string): Promise<VerificationRequestRecord | null>;
}

export interface PhoneAlertRepository {
  registerCall(callSid: string): Promise<boolean>;
  getInternalByCallHash(callSidHash: string): Promise<PhoneAlertRecord | null>;
}

export type ExpiryResult = {
  expiredChecks: number;
  expiredRequests: number;
};

export interface ExpiryRepository {
  expirePendingChecks(): Promise<ExpiryResult>;
}

export interface HouseholdRepository {
  getInternalById(id: string): Promise<HouseholdRecord | null>;
}

/**
 * CC-202 destination verification. This contract is deliberately distinct from
 * {@link VerificationRequestRepository}: different token purpose, different
 * table, different audit events, different validation. There is intentionally no
 * method that lets a caller mark a destination verified directly — verification
 * only happens by consuming a one-time secret inside the trusted boundary.
 */
export type AbuseFactors = {
  /** Opaque network hint, hashed before use; never stored raw. */
  networkHint?: string;
};

/**
 * Start verifies the contact's *currently stored* destination and channel. The
 * destination is deliberately not re-supplied here so a caller cannot issue a
 * secret for one value while a different value is recorded. Set or change the
 * destination through {@link EnrollmentVerificationRepository.createContact} or
 * {@link EnrollmentVerificationRepository.changeDestination}.
 */
export type StartEnrollmentInput = {
  householdId: string;
  trustedContactId: string;
  requestId?: string;
} & AbuseFactors;

/**
 * The raw secret is returned only to the trusted server caller (the notification
 * service in CC-203, or a clearly labeled demo response). It is never persisted
 * and never exposed to the browser in production.
 */
export type DeliverySecret =
  | { kind: "code"; code: string }
  | { kind: "link"; rawToken: string };

export type StartEnrollmentResult =
  | {
      ok: true;
      verificationId: string;
      channel: EnrollmentChannel;
      expiresAt: string;
      deliverySecret: DeliverySecret;
    }
  | {
      ok: false;
      code: "INVALID_DESTINATION" | "CONTACT_NOT_FOUND" | "RATE_LIMITED";
    };

/**
 * Confirmation failures collapse to a single generic `INVALID` so an attacker
 * cannot distinguish unknown, wrong, expired, used, or locked states (no
 * enumeration of token validity or enrollment state). `RATE_LIMITED` only
 * signals throttling and likewise reveals nothing about validity.
 */
export type EnrollmentConfirmResult =
  | { ok: true; status: "VERIFIED" }
  | { ok: false; code: "INVALID" | "RATE_LIMITED" };

export type CreateContactInput = {
  householdId: string;
  displayName: string;
  channel: EnrollmentChannel;
  destination: string;
  requestId?: string;
};

export type CreateContactResult =
  | { ok: true; contact: TrustedContactRecord }
  | { ok: false; code: "INVALID_DESTINATION" };

export type ChangeDestinationInput = {
  trustedContactId: string;
  channel: EnrollmentChannel;
  destination: string;
  requestId?: string;
};

export type ChangeDestinationResult =
  | { ok: true; contact: TrustedContactRecord }
  | { ok: false; code: "INVALID_DESTINATION" | "CONTACT_NOT_FOUND" };

export interface EnrollmentVerificationRepository {
  /** Enrollment-time contact creation. The destination starts unverified. */
  createContact(input: CreateContactInput): Promise<CreateContactResult>;
  /** Issue a one-time enrollment secret for an existing contact. */
  start(input: StartEnrollmentInput): Promise<StartEnrollmentResult>;
  /** Email/link flow: located by token hash, no identifier in the URL. */
  confirmByToken(
    rawToken: string,
    factors?: AbuseFactors,
  ): Promise<EnrollmentConfirmResult>;
  /** SMS/code flow: scoped to a contact, strict attempt limits. */
  confirmByCode(
    trustedContactId: string,
    code: string,
    factors?: AbuseFactors,
  ): Promise<EnrollmentConfirmResult>;
  /** Public-safe status; never includes destination or secret hash. */
  getStatus(
    trustedContactId: string,
  ): Promise<EnrollmentVerificationStatusView | null>;
  /** Changing a destination always clears prior verification. */
  changeDestination(
    input: ChangeDestinationInput,
  ): Promise<ChangeDestinationResult>;
}

export interface CircleCheckRepositories {
  checks: CheckRepository;
  trustedContacts: TrustedContactRepository;
  verificationRequests: VerificationRequestRepository;
  enrollmentVerifications: EnrollmentVerificationRepository;
  phoneAlerts: PhoneAlertRepository;
  expiry: ExpiryRepository;
  households: HouseholdRepository;
  resetDemo?: () => Promise<void>;
}
