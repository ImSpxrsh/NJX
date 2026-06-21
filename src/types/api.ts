import type {
  CheckState,
  EnrollmentChannel,
  EnrollmentVerificationStatusView,
  EvidenceExtraction,
  PolicyDecision,
  PublicEvidenceSignal,
  SignalName,
  StatusSource,
  VerificationLevel,
} from "./domain";

export type AnalyzeResponse = {
  checkId: string;
  state: "PAUSED" | "PENDING";
  extraction: EvidenceExtraction;
  decision: PolicyDecision;
  verification?: {
    requestId: string;
    expiresAt: string;
    demoContactUrl?: string;
  };
};

export type CheckStatusResponse = {
  checkId: string;
  state: CheckState;
  level: VerificationLevel;
  summary: string;
  requestedAction: string | null;
  policyReasons: string[];
  contactResponseStatus: string;
  expiresAt: string | null;
  statusSource: StatusSource;
  signals: Record<SignalName, PublicEvidenceSignal>;
};

// --- Enrollment destination verification (CC-202) ---

export type CreateContactResponse = {
  contactId: string;
  channel: EnrollmentChannel;
  destinationVerified: false;
};

export type EnrollmentStartResponse = {
  verificationId: string;
  channel: EnrollmentChannel;
  expiresAt: string;
  demoMode: boolean;
  /** Present only when enrollment demo mode is explicitly enabled. */
  demo?: {
    notice: string;
    channel: EnrollmentChannel;
    code?: string;
    verifyUrl?: string;
  };
};

export type EnrollmentConfirmResponse = { ok: boolean };

export type EnrollmentStatusResponse = EnrollmentVerificationStatusView;

// --- Enrollment contact management (CC-201 / CC-404) ---
// Public-safe contact projection. Deliberately omits the raw destination value
// (phone/email) and household id, per the API-wide rule that responses never
// include contact destinations.
export type EnrollmentContactView = {
  contactId: string;
  displayName: string;
  channel: "sms" | "email" | "manual_demo";
  destinationVerified: boolean;
  createdAt: string;
};

export type ContactListResponse = { contacts: EnrollmentContactView[] };

export type DeleteContactResponse = { ok: boolean };

// High-trust gate: a high-trust workflow may target a contact only when its
// destination is already verified.
export type HighTrustEligibilityResponse = {
  eligible: boolean;
  contact: EnrollmentContactView;
};
