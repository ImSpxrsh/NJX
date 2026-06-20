import { describe, expect, it } from "vitest";
import { normalizeEmail, normalizePhoneE164 } from "./destination";

describe("phone normalization", () => {
  it("accepts and compacts E.164 input", () => {
    expect(normalizePhoneE164(" +1 (555) 123-4567 ")).toEqual({
      ok: true,
      destination: { channel: "sms", value: "+15551234567" },
    });
  });

  it("rejects non-E.164 numbers", () => {
    for (const bad of ["5551234567", "+0123", "+", "+1abc5550000", ""]) {
      expect(normalizePhoneE164(bad).ok).toBe(false);
    }
  });
});

describe("email normalization", () => {
  it("lowercases and trims valid addresses", () => {
    expect(normalizeEmail("  Person@Example.COM ")).toEqual({
      ok: true,
      destination: { channel: "email", value: "person@example.com" },
    });
  });

  it("rejects malformed addresses", () => {
    for (const bad of ["nope", "a@b", "a@@b.com", "a b@c.com", "@x.com", ""]) {
      expect(normalizeEmail(bad).ok).toBe(false);
    }
  });
});
