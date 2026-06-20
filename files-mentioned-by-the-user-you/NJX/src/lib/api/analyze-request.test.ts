import { describe, expect, it } from "vitest";
import { analyzeRequestSchema } from "./analyze-request";

const validRequest = {
  householdId: "00000000-0000-4000-8000-000000000001",
  message: "Please check this request.",
  mode: "fixture" as const,
};

describe("analyze request contract", () => {
  it("accepts the intended request fields", () => {
    expect(analyzeRequestSchema.parse(validRequest)).toEqual(validRequest);
  });

  it.each([
    { demo: true },
    { isDemo: true },
    { runtimeMode: "demo" },
    { demoContactUrl: "https://attacker.test/verify/token" },
    { rawToken: "attacker-controlled" },
  ])("rejects client-controlled demo activation fields", (extra) => {
    expect(() =>
      analyzeRequestSchema.parse({ ...validRequest, ...extra }),
    ).toThrow();
  });
});
