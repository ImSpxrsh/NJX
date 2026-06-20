import { describe, expect, it } from "vitest";
import { ContactError } from "./errors";
import {
  createContactSchema,
  normalizeEmail,
  normalizePhone,
} from "./normalization";

describe("phone normalization", () => {
  it("normalizes national format to E.164", () => {
    expect(normalizePhone("(609) 555-1212")).toBe("+16095551212");
    expect(normalizePhone("609-555-1212")).toBe("+16095551212");
  });

  it("preserves valid E.164 input", () => {
    expect(normalizePhone("+16095551212")).toBe("+16095551212");
  });

  it("rejects extensions", () => {
    expect(() => normalizePhone("609-555-1212 ext 4")).toThrow(ContactError);
  });

  it("rejects unparseable input", () => {
    expect(() => normalizePhone("not a phone")).toThrow(ContactError);
  });

  it("rejects empty input", () => {
    expect(() => normalizePhone("   ")).toThrow(ContactError);
  });
});

describe("email normalization", () => {
  it("trims and lowercases", () => {
    expect(normalizeEmail("  Test@Example.COM ")).toBe("test@example.com");
    expect(normalizeEmail("John.Doe@Domain.com")).toBe("john.doe@domain.com");
  });

  it("rejects malformed addresses", () => {
    expect(() => normalizeEmail("not-an-email")).toThrow(ContactError);
    expect(() => normalizeEmail("foo@")).toThrow(ContactError);
  });
});

describe("createContactSchema", () => {
  it("requires at least one channel", () => {
    expect(createContactSchema.safeParse({ displayName: "A" }).success).toBe(
      false,
    );
  });

  it("rejects unknown fields, including household_id injection", () => {
    const result = createContactSchema.safeParse({
      displayName: "Attacker",
      phone: "+16095551212",
      household_id: "victim-household",
    });
    expect(result.success).toBe(false);
  });

  it("accepts a valid phone-only payload", () => {
    expect(
      createContactSchema.safeParse({
        displayName: "Alex",
        phone: "(609) 555-1212",
      }).success,
    ).toBe(true);
  });
});
