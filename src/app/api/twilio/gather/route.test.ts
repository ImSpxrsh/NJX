import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  buildTwilioRequest,
  signTwilioRequest,
} from "@/lib/security/twilio-test-helpers";
import { resetRepositoryFactoryForTests } from "@/lib/repository/factory";
import { getCheck, resetDemo } from "@/lib/repository/demo-store";
import { sha256 } from "@/lib/security/hashing";
import { resetRateLimitsForTests } from "@/lib/security/rate-limit";
import { resetRuntimeConfigForTests } from "@/lib/runtime-config";
import { POST } from "./route";

const TOKEN = "gather-route-token-dddddddddddddddddddd";
const BASE = "https://app.example.com";
const savedEnv = { ...process.env };

beforeEach(() => {
  process.env = {
    ...savedEnv,
    CIRCLECHECK_RUNTIME_MODE: "demo",
    CIRCLECHECK_REPOSITORY_MODE: "demo",
    DEMO_CALLER_PHONE_E164: "+15551234567",
    PUBLIC_APP_URL: BASE,
    TWILIO_AUTH_TOKEN: TOKEN,
    TWILIO_PUBLIC_BASE_URL: BASE,
  };
  resetRuntimeConfigForTests();
  resetRepositoryFactoryForTests();
  resetDemo();
  resetRateLimitsForTests();
});

afterEach(() => {
  process.env = { ...savedEnv };
  resetRuntimeConfigForTests();
  resetRepositoryFactoryForTests();
  resetRateLimitsForTests();
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

async function repositories() {
  return import("@/lib/repository/factory").then((mod) =>
    mod.getRepositories(),
  );
}

describe("POST /api/twilio/gather", () => {
  it("known caller creates one pending phone alert", async () => {
    await POST(
      signed({
        Digits: "1",
        CallSid: "known-call",
        From: "+1 (555) 123-4567",
      }),
    );
    const repos = await repositories();
    const alert = await repos.phoneAlerts.getInternalByCallHash(
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
      await repos.verificationNotifications.getInternalByRequestId(
        alert!.verificationRequestId,
      );
    expect(notification?.verificationUrl).toContain("/verify/");
  });

  it("unknown caller receives generic instructions without creating an alert", async () => {
    const response = await POST(
      signed({ Digits: "1", CallSid: "unknown-call", From: "+15557654321" }),
    );
    const repos = await repositories();

    expect(await response.text()).toContain("trusted number printed");
    await expect(
      repos.phoneAlerts.getInternalByCallHash(sha256("unknown-call")),
    ).resolves.toBeNull();
  });

  it("caller ID routing cannot create VERIFIED", async () => {
    await POST(
      signed({ Digits: "1", CallSid: "spoofed-call", From: "+15551234567" }),
    );
    const repos = await repositories();
    const alert = await repos.phoneAlerts.getInternalByCallHash(
      sha256("spoofed-call"),
    );

    expect(getCheck(alert!.checkId)?.state).toBe("PENDING");
  });

  it("notification failure still returns safe instructions", async () => {
    process.env.DEMO_NOTIFICATION_FAIL = "1";
    const response = await POST(
      signed({ Digits: "1", CallSid: "notify-fail", From: "+15551234567" }),
    );
    expect(await response.text()).toContain("Do not send anything yet");
  });

  it("invalid digits and TwiML introduce no recording or transcription", async () => {
    const response = await POST(
      signed({ Digits: "9", CallSid: "bad-digit", From: "+15551234567" }),
    );
    const body = await response.text();
    expect(body).toContain("No alert was created");
    expect(body).not.toContain("<Record");
    expect(body).not.toContain("RecordingUrl");
    expect(body).not.toContain("Transcription");
  });

  it("repeated CallSid is idempotent", async () => {
    await POST(
      signed({ Digits: "1", CallSid: "repeat-call", From: "+15551234567" }),
    );
    const repos = await repositories();
    const firstAlert = await repos.phoneAlerts.getInternalByCallHash(
      sha256("repeat-call"),
    );
    await POST(
      signed({ Digits: "1", CallSid: "repeat-call", From: "+15551234567" }),
    );
    const secondAlert = await repos.phoneAlerts.getInternalByCallHash(
      sha256("repeat-call"),
    );

    expect(secondAlert?.id).toBe(firstAlert?.id);
    expect(secondAlert?.checkId).toBe(firstAlert?.checkId);
  });

  it("makes no trust-state change on a missing signature", async () => {
    const response = await POST(
      buildTwilioRequest({
        url: "http://internal.local/api/twilio/gather",
        params: { CallSid: "CA-2", Digits: "1", From: "+15551234567" },
      }),
    );
    expect(response.status).toBe(403);
    const repos = await repositories();
    await expect(
      repos.phoneAlerts.getInternalByCallHash(sha256("CA-2")),
    ).resolves.toBeNull();
  });

  it("rate limits repeated gather callbacks without creating an approval", async () => {
    const params = {
      CallSid: "rate-limited-call",
      Digits: "1",
      From: "+15551234567",
    };
    for (let i = 0; i < 5; i += 1) {
      await POST(signed(params));
    }

    const response = await POST(signed(params));

    expect(response.status).toBe(429);
    expect(response.headers.get("retry-after")).toBeTruthy();
    expect(await response.text()).toContain("Do not send anything yet");
    const repos = await repositories();
    const alert = await repos.phoneAlerts.getInternalByCallHash(
      sha256("rate-limited-call"),
    );
    expect(getCheck(alert!.checkId)?.state).toBe("PENDING");
  });
});
