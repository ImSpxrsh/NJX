import { describe, expect, it } from "vitest";
import { logSecurityEvent, setLogSinkForTests } from "./logger";

describe("logSecurityEvent", () => {
  it("emits only the allowlisted structured fields", () => {
    const events: unknown[] = [];
    setLogSinkForTests((event) => events.push(event));
    logSecurityEvent({
      route: "/api/analyze",
      outcome: "failure",
      requestId: "req",
      checkId: "00000000-0000-4000-8000-000000000001",
      level: "L3",
      code: "rate_limited",
    });
    setLogSinkForTests(null);

    expect(events).toEqual([
      {
        route: "/api/analyze",
        outcome: "failure",
        requestId: "req",
        checkId: "00000000-0000-4000-8000-000000000001",
        level: "L3",
        code: "rate_limited",
      },
    ]);
    expect(JSON.stringify(events)).not.toMatch(
      /token|authorization|phone|\+1555/i,
    );
  });
});
