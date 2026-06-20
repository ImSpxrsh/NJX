import type {
  CheckState,
  EvidenceExtraction,
  PolicyDecision,
  PublicEvidenceSignal,
  SignalName,
  StatusSource,
  VerificationLevel,
} from "./domain";

// Production response — never contains verification tokens or demo-only fields.
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

// Demo response — only returned from an explicitly enabled demo deployment.
export type AnalyzeDemoResponse = AnalyzeProductionResponse & {
  demoContactUrl: string;
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
