import type {
  CheckRecord,
  ContactDestinationVerificationRecord,
  DestinationVerificationChannel,
  EnrollmentChannel,
  EnrollmentVerificationStatusView,
  EvidenceExtraction,
  HouseholdRecord,
  PhoneAlertRecord,
  PhoneCallerRoute,
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

export type PendingVerificationCreationInput = {
  checkId: string;
  householdId: string;
  expiresAt: string;
};

export interface PendingVerificationCreator {
  create(input: PendingVerificationCreationInput): Promise<CreatedVerification>;
}

export type CheckCreationResult = {
  check: PublicCheckRecord;
  verification?: CreatedVerification;
};

export interface CheckRepository {
  create(input: CheckCreationInput): Promise<CheckCreationResult>;
  getPublicById(
    id: string,
    scope?: { householdId: string },
  ): Promise<PublicCheckRecord | null>;
  getInternalById(id: string): Promise<CheckRecord | null>;
}

// Channel fields are server-normalized before reaching the repository. The
// repository never receives or trusts verification state on writes.
export type ContactWriteInput = {
  householdId: string;
  displayName: string;
  phoneE164: string | null;
  email: string | null;
  channel: "sms" | "email" | "manual_demo";
};

export interface TrustedContactRepository {
  getInternalById(id: string): Promise<TrustedContactRecord | null>;
  getVerifiedForHousehold(
    householdId: string,
  ): Promise<TrustedContactRecord | null>;
  listForHousehold(householdId: string): Promise<TrustedContactRecord[]>;
  countForHousehold(householdId: string): Promise<number>;
  // Enrollment writes always persist unverified destinations.
  create(input: ContactWriteInput): Promise<TrustedContactRecord>;
  // Updating a destination ALWAYS clears prior verification state, forcing
  // re-verification. The repository enforces this at the storage boundary.
  update(
    id: string,
    input: Omit<ContactWriteInput, "householdId">,
  ): Promise<TrustedContactRecord>;
  remove(id: string): Promise<void>;
}

export type DestinationChallengeInput = {
  trustedContactId: string;
  householdId: string;
  channel: DestinationVerificationChannel;
  codeHash: string;
  expiresAt: string;
};

// Destination-verification storage. Deliberately a SEPARATE repository from
// enrollment to keep the two workflows decoupled.
export interface ContactVerificationRepository {
  // Creating a challenge invalidates any prior active challenge for the contact
  // so only the newest code can ever succeed.
  createChallenge(
    input: DestinationChallengeInput,
  ): Promise<ContactDestinationVerificationRecord>;
  getActiveChallenge(
    trustedContactId: string,
  ): Promise<ContactDestinationVerificationRecord | null>;
  registerFailedAttempt(challengeId: string): Promise<number>;
  expireChallenge(challengeId: string): Promise<void>;
  // Atomically consume the challenge and mark the destination verified,
  // returning the updated contact (invariant: consumption + state change are
  // a single transaction in Postgres).
  completeChallenge(input: {
    challengeId: string;
    trustedContactId: string;
    channel: DestinationVerificationChannel;
    verifiedAt: string;
  }): Promise<TrustedContactRecord>;
  countStartsSince(householdId: string, sinceIso: string): Promise<number>;
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
  resolveHouseholdForCaller(
    caller: string | null | undefined,
  ): Promise<PhoneCallerRoute | null>;
  registerCall(callSid: string): Promise<boolean>;
  recordAlert(input: {
    callSid: string;
    householdId: string;
    checkId: string;
    verificationRequestId: string;
    pressedDigit: "1";
  }): Promise<PhoneAlertRecord>;
  getInternalByCallHash(callSidHash: string): Promise<PhoneAlertRecord | null>;
}

export type VerificationNotification = {
  requestId: string;
  verificationUrl: string;
  deliveredAt: string;
};

export interface VerificationNotificationRepository {
  sendVerificationLink(input: {
    requestId: string;
    rawToken: string;
    appUrl: string;
  }): Promise<VerificationNotification>;
  getInternalByRequestId(requestId: string): Promise<VerificationNotification | null>;
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
  contactVerifications: ContactVerificationRepository;
  verificationRequests: VerificationRequestRepository;
  enrollmentVerifications: EnrollmentVerificationRepository;
  phoneAlerts: PhoneAlertRepository;
  verificationNotifications: VerificationNotificationRepository;
  expiry: ExpiryRepository;
  households: HouseholdRepository;
  resetDemo?: () => Promise<void>;
}
