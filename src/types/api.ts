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

export type AnalyzeProductionResponse = {
  checkId: string;
  state: "PAUSED" | "PENDING";
  extraction: EvidenceExtraction;
  decision: PolicyDecision;
  verification?: {
    requestId: string;
    expiresAt: string;
  };
};

export type AnalyzeDemoResponse = Omit<
  AnalyzeProductionResponse,
  "verification"
> & {
  verification?: {
    requestId: string;
    expiresAt: string;
    demoContactUrl: string;
  };
};

export type AnalyzeResponse = AnalyzeProductionResponse | AnalyzeDemoResponse;

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
