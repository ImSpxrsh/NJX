import type { CheckState } from "@/types/domain";

export const allowedTransitions: Readonly<Record<CheckState, CheckState[]>> = {
  RECEIVED: ["PAUSED"],
  PAUSED: ["PENDING"],
  PENDING: ["VERIFIED", "DENIED", "EXPIRED"],
  VERIFIED: [],
  DENIED: [],
  EXPIRED: [],
};

export function canTransition(from: CheckState, to: CheckState): boolean {
  return allowedTransitions[from].includes(to);
}
