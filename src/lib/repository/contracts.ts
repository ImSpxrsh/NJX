import type {
  CheckRecord,
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

export interface HouseholdRepository {
  getInternalById(id: string): Promise<HouseholdRecord | null>;
}

export interface CircleCheckRepositories {
  checks: CheckRepository;
  trustedContacts: TrustedContactRepository;
  verificationRequests: VerificationRequestRepository;
  phoneAlerts: PhoneAlertRepository;
  households: HouseholdRepository;
  resetDemo?: () => Promise<void>;
}
