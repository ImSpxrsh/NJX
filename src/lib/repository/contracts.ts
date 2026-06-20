import type {
  CheckRecord,
  ContactDestinationVerificationRecord,
  DestinationVerificationChannel,
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
  registerCall(callSid: string): Promise<boolean>;
  getInternalByCallHash(callSidHash: string): Promise<PhoneAlertRecord | null>;
}

export interface HouseholdRepository {
  getInternalById(id: string): Promise<HouseholdRecord | null>;
}

export interface CircleCheckRepositories {
  checks: CheckRepository;
  trustedContacts: TrustedContactRepository;
  contactVerifications: ContactVerificationRepository;
  verificationRequests: VerificationRequestRepository;
  phoneAlerts: PhoneAlertRepository;
  households: HouseholdRepository;
  resetDemo?: () => Promise<void>;
}
