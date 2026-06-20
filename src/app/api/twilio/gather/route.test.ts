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
