import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  buildTwilioRequest,
  signTwilioRequest,
} from "@/lib/security/twilio-test-helpers";
import { resetRateLimitsForTests } from "@/lib/security/rate-limit";
import { POST } from "./route";

const TOKEN = "voice-route-token-cccccccccccccccccccc";
const BASE = "https://app.example.com";
const PARAMS = { CallSid: "CA-voice", From: "+15550001111" };
const savedEnv = { ...process.env };

beforeEach(() => {
  process.env = {
    ...savedEnv,
    TWILIO_AUTH_TOKEN: TOKEN,
    TWILIO_PUBLIC_BASE_URL: BASE,
  };
  resetRateLimitsForTests();
});

afterEach(() => {
  process.env = { ...savedEnv };
  resetRateLimitsForTests();
});

function signed() {
  const signature = signTwilioRequest({
    authToken: TOKEN,
    url: `${BASE}/api/twilio/voice`,
    params: PARAMS,
  });
  return buildTwilioRequest({
    url: "http://internal.local/api/twilio/voice",
    params: PARAMS,
    signature,
  });
}

describe("POST /api/twilio/voice", () => {
  it("returns TwiML with a Gather for a valid signature", async () => {
    const response = await POST(signed());
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("text/xml");
    const body = await response.text();
    expect(body).toContain("<Gather");
    expect(body.toLowerCase()).toContain("press 1");
  });

  it("returns a generic 403 for a missing signature", async () => {
    const response = await POST(
      buildTwilioRequest({
        url: "http://internal.local/api/twilio/voice",
        params: PARAMS,
      }),
    );
    expect(response.status).toBe(403);
    expect(await response.text()).not.toContain("<Gather");
  });

  it("returns a generic 403 for an invalid signature", async () => {
    const response = await POST(
      buildTwilioRequest({
        url: "http://internal.local/api/twilio/voice",
        params: PARAMS,
        signature: "bad",
      }),
    );
    expect(response.status).toBe(403);
  });

  it("rate limits repeated valid callbacks with safe TwiML", async () => {
    for (let i = 0; i < 10; i += 1) {
      await POST(signed());
    }
    const response = await POST(signed());

    expect(response.status).toBe(429);
    expect(response.headers.get("retry-after")).toBeTruthy();
    expect(await response.text()).toContain("call a number you know");
  });
});
