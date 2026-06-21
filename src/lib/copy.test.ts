import { describe, expect, it } from "vitest";
import { copy } from "./copy";

describe("security copy registry", () => {
  it("covers all check states", () => {
    const states: string[] = [
      "RECEIVED",
      "PAUSED",
      "PENDING",
      "VERIFIED",
      "DENIED",
      "EXPIRED",
    ];
    for (const state of states) {
      expect(copy.states[state as keyof typeof copy.states]).toBeDefined();
    }
  });

  it("action copy for L3 instructs stop-and-verify", () => {
    expect(copy.actions.MANDATORY_HOLD_AND_VERIFY).toContain("Do not act");
  });

  it("no copy claims message is safe or guaranteed", () => {
    // Exclude the forbidden list itself from the check — it exists to name the phrases
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { forbidden: _forbidden, ...copyWithoutForbidden } = copy;
    const allCopy = JSON.stringify(copyWithoutForbidden);
    for (const forbidden of copy.forbidden) {
      expect(allCopy.toLowerCase()).not.toContain(forbidden.toLowerCase());
    }
  });

  it("VERIFIED state copy attributes response to trusted contact, not to system", () => {
    expect(copy.states.VERIFIED).toContain("trusted contact");
    expect(copy.states.VERIFIED).not.toContain("safe");
    expect(copy.states.VERIFIED).not.toContain("legitimate");
  });

  it("failure copy instructs not to act", () => {
    for (const msg of Object.values(copy.failures)) {
      expect(msg.toLowerCase()).toMatch(
        /do not act|safety card|number you already know|verify/i,
      );
    }
  });
});
