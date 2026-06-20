import type {
  CheckRecord,
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
}

export interface HouseholdRepository {
  getInternalById(id: string): Promise<HouseholdRecord | null>;
}

export interface CircleCheckRepositories {
  checks: CheckRepository;
  trustedContacts: TrustedContactRepository;
  verificationRequests: VerificationRequestRepository;
  phoneAlerts: PhoneAlertRepository;
  verificationNotifications: VerificationNotificationRepository;
  households: HouseholdRepository;
  resetDemo?: () => Promise<void>;
}
