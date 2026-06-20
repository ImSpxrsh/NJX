import type { CheckState } from "@/types/domain";
import { canTransition } from "./transitions";

export function transitionCheck(from: CheckState, to: CheckState): CheckState {
  if (!canTransition(from, to)) {
    throw new Error(`Forbidden check transition: ${from} -> ${to}`);
  }
  return to;
}
