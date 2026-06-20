import { describe, expect, it } from "vitest";
import { redactSensitive } from "./redact";

describe("redactSensitive", () => {
  it("redacts token, auth, phone, destination, and verification link shaped fields", () => {
    expect(
      redactSensitive({
        token: "raw-token",
        authorization: "Bearer secret",
        phoneE164: "+15551234567",
        destination: "trusted-contact@example.test",
        verificationUrl: "https://example.test/verify/raw-token",
        nested: { contact: "private" },
      }),
    ).toEqual({
      token: "[REDACTED]",
      authorization: "[REDACTED]",
      phoneE164: "[REDACTED]",
      destination: "[REDACTED]",
      verificationUrl: "[REDACTED]",
      nested: { contact: "[REDACTED]" },
    });
  });
});
