import { beforeEach, describe, expect, it } from "vitest";
import { resetRepositoryFactoryForTests } from "@/lib/repository/factory";
import { getCheck, resetDemo } from "@/lib/repository/demo-store";
import { sha256 } from "@/lib/security/hashing";
import { POST } from "./route";

function request(params: Record<string, string>): Request {
  return new Request("https://example.test/api/twilio/gather", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(params),
  });
}

describe("POST /api/twilio/gather", () => {
  beforeEach(() => {
    process.env.CIRCLECHECK_REPOSITORY_MODE = "demo";
    process.env.DEMO_CALLER_PHONE_E164 = "+15551234567";
    delete process.env.TWILIO_AUTH_TOKEN;
    resetRepositoryFactoryForTests();
    resetDemo();
  });

  it("known caller creates one pending phone alert", async () => {
    await POST(
      request({
        Digits: "1",
        CallSid: "known-call",
        From: "+1 (555) 123-4567",
      }),
    );
    const repositories = await import("@/lib/repository/factory").then((mod) =>
      mod.getRepositories(),
    );
    const alert = await repositories.phoneAlerts.getInternalByCallHash(
      sha256("known-call"),
    );

    expect(alert).toBeDefined();
    expect(alert?.householdId).toBe("00000000-0000-4000-8000-000000000001");
    expect(alert?.pressedDigit).toBe("1");
    expect(getCheck(alert!.checkId)).toMatchObject({
      state: "PENDING",
      source: "phone",
    });
    const notification =
      await repositories.verificationNotifications.getInternalByRequestId(
        alert!.verificationRequestId,
      );
    expect(notification?.verificationUrl).toContain("/verify/");
  });

  it("unknown caller receives generic instructions without creating an alert", async () => {
    const response = await POST(
      request({ Digits: "1", CallSid: "unknown-call", From: "+15557654321" }),
    );
    const repositories = await import("@/lib/repository/factory").then((mod) =>
      mod.getRepositories(),
    );

    expect(await response.text()).toContain("trusted number printed");
    await expect(
      repositories.phoneAlerts.getInternalByCallHash(sha256("unknown-call")),
    ).resolves.toBeNull();
  });

  it("caller ID routing cannot create VERIFIED", async () => {
    await POST(
      request({ Digits: "1", CallSid: "spoofed-call", From: "+15551234567" }),
    );
    const repositories = await import("@/lib/repository/factory").then((mod) =>
      mod.getRepositories(),
    );
    const alert = await repositories.phoneAlerts.getInternalByCallHash(
      sha256("spoofed-call"),
    );

    expect(getCheck(alert!.checkId)?.state).toBe("PENDING");
  });

  it("notification failure still returns safe instructions", async () => {
    process.env.DEMO_NOTIFICATION_FAIL = "1";
    try {
      const response = await POST(
        request({ Digits: "1", CallSid: "notify-fail", From: "+15551234567" }),
      );
      expect(await response.text()).toContain("Do not send anything yet");
    } finally {
      delete process.env.DEMO_NOTIFICATION_FAIL;
    }
  });

  it("invalid digits and TwiML introduce no recording or transcription", async () => {
    const response = await POST(
      request({ Digits: "9", CallSid: "bad-digit", From: "+15551234567" }),
    );
    const body = await response.text();
    expect(body).toContain("No alert was created");
    expect(body).not.toContain("<Record");
    expect(body).not.toContain("RecordingUrl");
    expect(body).not.toContain("Transcription");
  });

  it("repeated CallSid is idempotent", async () => {
    await POST(
      request({ Digits: "1", CallSid: "repeat-call", From: "+15551234567" }),
    );
    const repositories = await import("@/lib/repository/factory").then((mod) =>
      mod.getRepositories(),
    );
    const firstAlert = await repositories.phoneAlerts.getInternalByCallHash(
      sha256("repeat-call"),
    );
    await POST(
      request({ Digits: "1", CallSid: "repeat-call", From: "+15551234567" }),
    );
    const secondAlert = await repositories.phoneAlerts.getInternalByCallHash(
      sha256("repeat-call"),
    );

    expect(secondAlert?.id).toBe(firstAlert?.id);
    expect(secondAlert?.checkId).toBe(firstAlert?.checkId);
  });
});
