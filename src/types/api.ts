import type {
  CheckState,
  DestinationVerificationChannel,
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

// --- Trusted-contact enrollment (CC-101) -----------------------------------

// Public-safe view of a destination. Never includes the household identifier,
// raw verification codes, or code hashes.
export type TrustedContactResponse = {
  id: string;
  displayName: string;
  phone: string | null;
  email: string | null;
  channel: "sms" | "email" | "manual_demo";
  verified: boolean;
  verifiedAt: string | null;
  verifiedChannel: DestinationVerificationChannel | null;
  createdAt: string;
  updatedAt: string;
};

export type ContactListResponse = {
  contacts: TrustedContactResponse[];
};

export type StartDestinationVerificationResponse = {
  verificationId: string;
  channel: DestinationVerificationChannel;
  expiresAt: string;
  // Present ONLY in demo mode as a labeled hackathon delivery channel, mirroring
  // analyze's demoContactUrl. Never set in production.
  demoCode?: string;
};
