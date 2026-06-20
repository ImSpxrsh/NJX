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
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  buildTwilioRequest,
  signTwilioRequest,
} from "@/lib/security/twilio-test-helpers";

const registerCall = vi.fn();
const createCheck = vi.fn();

vi.mock("@/lib/repository/factory", () => ({
  getRepositories: () => ({
    phoneAlerts: { registerCall },
    checks: { create: createCheck },
  }),
}));

import { POST } from "./route";

const TOKEN = "gather-route-token-dddddddddddddddddddd";
const BASE = "https://app.example.com";
const savedEnv = { ...process.env };

beforeEach(() => {
  process.env = {
    ...savedEnv,
    TWILIO_AUTH_TOKEN: TOKEN,
    TWILIO_PUBLIC_BASE_URL: BASE,
  };
  registerCall.mockReset().mockResolvedValue(true);
  createCheck.mockReset().mockResolvedValue({ check: {} });
});

afterEach(() => {
  process.env = { ...savedEnv };
});

function signed(params: Record<string, string>) {
  const signature = signTwilioRequest({
    authToken: TOKEN,
    url: `${BASE}/api/twilio/gather`,
    params,
  });
  return buildTwilioRequest({
    url: "http://internal.local/api/twilio/gather",
    params,
    signature,
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
  it("creates a phone-originated L3 check when digit 1 is pressed with a valid signature", async () => {
    const response = await POST(signed({ CallSid: "CA-1", Digits: "1" }));
    expect(response.status).toBe(200);
    expect(registerCall).toHaveBeenCalledWith("CA-1");
    expect(createCheck).toHaveBeenCalledTimes(1);
    expect(createCheck.mock.calls[0]![0]).toMatchObject({
      source: "phone",
      decision: { level: "L3", verificationRequired: true },
    });
  });

  it("makes no trust-state change on a missing signature", async () => {
    const response = await POST(
      buildTwilioRequest({
        url: "http://internal.local/api/twilio/gather",
        params: { CallSid: "CA-2", Digits: "1" },
      }),
    );
    expect(response.status).toBe(403);
    expect(registerCall).not.toHaveBeenCalled();
    expect(createCheck).not.toHaveBeenCalled();
  });

  it("makes no trust-state change on an invalid signature", async () => {
    const response = await POST(
      buildTwilioRequest({
        url: "http://internal.local/api/twilio/gather",
        params: { CallSid: "CA-3", Digits: "1" },
        signature: "tampered",
      }),
    );
    expect(response.status).toBe(403);
    expect(registerCall).not.toHaveBeenCalled();
    expect(createCheck).not.toHaveBeenCalled();
  });

  it("creates no check for a non-1 digit even with a valid signature", async () => {
    const response = await POST(signed({ CallSid: "CA-4", Digits: "5" }));
    expect(response.status).toBe(200);
    expect(registerCall).not.toHaveBeenCalled();
    expect(createCheck).not.toHaveBeenCalled();
  });
});