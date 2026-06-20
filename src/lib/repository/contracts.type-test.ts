import type { CheckCreationInput, CheckRepository } from "./contracts";
import type { EvidenceExtraction, PolicyDecision } from "@/types/domain";

declare const extraction: EvidenceExtraction;
declare const decision: PolicyDecision;
declare const checks: CheckRepository;

const validInput: CheckCreationInput = {
  householdId: "00000000-0000-4000-8000-000000000001",
  source: "web",
  extraction,
  decision,
};

void checks.create(validInput);

void checks.create({
  ...validInput,
  // @ts-expect-error A caller cannot choose a persisted or terminal state.
  state: "VERIFIED",
});

// @ts-expect-error There is intentionally no arbitrary state update method.
void checks.updateState("check-id", "VERIFIED");
