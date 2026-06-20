export type SignalName =
  | "urgency"
  | "secrecy"
  | "payment"
  | "credentials"
  | "changed_contact";

export type EvidenceSignal = {
  name: SignalName;
  score: number;
  present: boolean;
  evidenceSpans: string[];
  explanation: string;
};

export type EvidenceExtraction = {
  schemaVersion: "1.0";
  requestedAction: string | null;
  claimedIdentity: string | null;
  signals: Record<SignalName, EvidenceSignal>;
  uncertainty: boolean;
  plainLanguageSummary: string;
};

export type VerificationLevel = "L0" | "L1" | "L2" | "L3";
export type RequiredAction =
  | "NONE"
  | "KNOWN_NUMBER_CALLBACK"
  | "TRUSTED_CONTACT_CONFIRMATION"
  | "MANDATORY_HOLD_AND_VERIFY";

export type PolicyDecision = {
  level: VerificationLevel;
  verificationRequired: boolean;
  reasons: string[];
  requiredAction: RequiredAction;
  policyScore: number;
};

export type CheckState =
  | "RECEIVED"
  | "PAUSED"
  | "PENDING"
  | "VERIFIED"
  | "DENIED"
  | "EXPIRED";

export type VerificationResponse = "CONFIRMED_MINE" | "DENIED_MINE" | "CALL_ME";

export type StatusSource =
  | "POLICY_ENGINE"
  | "ENROLLED_CONTACT"
  | "NO_RESPONSE"
  | "SYSTEM_EXPIRY";

export type CheckRecord = {
  id: string;
  householdId: string;
  source: "web" | "phone";
  state: CheckState;
  verificationLevel: VerificationLevel;
  sanitizedSummary: string;
  extraction: EvidenceExtraction;
  policyReasons: string[];
  requestedAction: string | null;
  createdAt: string;
  updatedAt: string;
  expiresAt: string | null;
  statusSource: StatusSource;
};

export type VerificationRequestRecord = {
  id: string;
  checkId: string;
  trustedContactId: string;
  tokenHash: string;
  status: "PENDING" | "COMPLETED" | "EXPIRED";
  response: VerificationResponse | null;
  expiresAt: string;
  usedAt: string | null;
  createdAt: string;
  respondedAt: string | null;
};
