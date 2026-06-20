import { describe, expect, it } from "vitest";
import { toClientVerificationMetadata } from "./verification-presentation";

const verification = {
  requestId: "00000000-0000-4000-8000-000000000001",
  expiresAt: "2026-06-20T12:10:00.000Z",
  rawToken: "raw-secret-token",
};

describe("verification client metadata", () => {
  it("exposes the contact URL only in explicit demo mode", () => {
    expect(
      toClientVerificationMetadata("demo", verification, "https://demo.test"),
    ).toMatchObject({
      demoContactUrl: "https://demo.test/verify/raw-secret-token",
    });
  });

  it("never exposes a raw token in Supabase mode", () => {
    const result = toClientVerificationMetadata(
      "supabase",
      verification,
      "https://circlecheck.test",
    );
    expect(result).not.toHaveProperty("demoContactUrl");
    expect(JSON.stringify(result)).not.toContain(verification.rawToken);
  });
});
