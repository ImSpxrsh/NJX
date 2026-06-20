import { describe, expect, it } from "vitest";
import type { CheckState } from "@/types/domain";
import { canTransition } from "./transitions";

const states: CheckState[] = [
  "RECEIVED",
  "PAUSED",
  "PENDING",
  "VERIFIED",
  "DENIED",
  "EXPIRED",
];
const allowed = new Set([
  "RECEIVED:PAUSED",
  "PAUSED:PENDING",
  "PENDING:VERIFIED",
  "PENDING:DENIED",
  "PENDING:EXPIRED",
]);

describe("check state machine", () => {
  for (const from of states) {
    for (const to of states) {
      it(`${allowed.has(`${from}:${to}`) ? "allows" : "rejects"} ${from} -> ${to}`, () => {
        expect(canTransition(from, to)).toBe(allowed.has(`${from}:${to}`));
      });
    }
  }
});
