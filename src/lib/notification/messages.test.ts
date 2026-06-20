import { describe, expect, it } from "vitest";
import { buildEnrollmentNotification } from "./messages";

describe("enrollment notification content", () => {
  it("email carries only the one-time link and no identifiers", () => {
    const note = buildEnrollmentNotification({
      channel: "email",
      to: "person@example.com",
      verifyUrl: "https://app.test/enroll/verify/TOKEN123",
    });
    expect(note.body).toContain("https://app.test/enroll/verify/TOKEN123");
    expect(note.body.toLowerCase()).not.toContain("household");
    // The body does not echo the destination address.
    expect(note.body).not.toContain("person@example.com");
  });

  it("sms carries only the code", () => {
    const note = buildEnrollmentNotification({
      channel: "sms",
      to: "+15551234567",
      code: "12345678",
    });
    expect(note.body).toContain("12345678");
    expect(note.body).not.toContain("+15551234567");
  });

  it("requires the matching secret for the channel", () => {
    expect(() =>
      buildEnrollmentNotification({ channel: "email", to: "a@b.com" }),
    ).toThrow();
    expect(() =>
      buildEnrollmentNotification({ channel: "sms", to: "+15551234567" }),
    ).toThrow();
  });
});
