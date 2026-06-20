import type {
  CheckState,
  EvidenceExtraction,
  PolicyDecision,
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
  signals: EvidenceExtraction["signals"];
};
