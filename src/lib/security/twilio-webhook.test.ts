import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  setAuditSinkForTests,
  type AuditEvent,
} from "@/lib/observability/audit";
import { verifyTwilioRequest } from "./twilio-webhook";
import { buildTwilioRequest, signTwilioRequest } from "./twilio-test-helpers";

const TOKEN = "test-auth-token-bbbbbbbbbbbbbbbbbbbb";
const BASE = "https://app.example.com";
const PARAMS = { CallSid: "CA999", From: "+15551112222", Digits: "1" };
const savedEnv = { ...process.env };

beforeEach(() => {
  process.env = { ...savedEnv };
  delete process.env.TWILIO_AUTH_TOKEN;
  delete process.env.TWILIO_PUBLIC_BASE_URL;
  delete process.env.PUBLIC_APP_URL;
  delete process.env.TWILIO_ALLOW_UNSIGNED;
});

afterEach(() => {
  setAuditSinkForTests(null);
  process.env = { ...savedEnv };
});

/** Build a request that should validate against the pinned base URL. */
function signedRequest(path: string, params = PARAMS) {
  const reconstructed = `${BASE}${path}`;
  const signature = signTwilioRequest({
    authToken: TOKEN,
    url: reconstructed,
    params,
  });
  return buildTwilioRequest({
    url: `http://internal.local${path}`,
    params,
    signature,
  });
}

describe("verifyTwilioRequest", () => {
  it("accepts a valid signature and returns parsed params", async () => {
    process.env.TWILIO_AUTH_TOKEN = TOKEN;
    process.env.TWILIO_PUBLIC_BASE_URL = BASE;
    const result = await verifyTwilioRequest(
      signedRequest("/api/twilio/voice"),
    );
    expect(result).toEqual({ ok: true, params: PARAMS });
  });

  it("rejects an invalid signature", async () => {
    process.env.TWILIO_AUTH_TOKEN = TOKEN;
    process.env.TWILIO_PUBLIC_BASE_URL = BASE;
    const request = buildTwilioRequest({
      url: "http://internal.local/api/twilio/voice",
      params: PARAMS,
      signature: "not-a-valid-signature",
    });
    expect(await verifyTwilioRequest(request)).toEqual({
      ok: false,
      code: "INVALID_SIGNATURE",
    });
  });

  it("rejects a missing signature when a token is configured", async () => {
    process.env.TWILIO_AUTH_TOKEN = TOKEN;
    process.env.TWILIO_PUBLIC_BASE_URL = BASE;
    const request = buildTwilioRequest({
      url: "http://internal.local/api/twilio/voice",
      params: PARAMS,
    });
    expect(await verifyTwilioRequest(request)).toEqual({
      ok: false,
      code: "MISSING_SIGNATURE",
    });
  });

  it("fails closed in production when no auth token is configured", async () => {
    const prev = process.env.NODE_ENV;
    Object.defineProperty(process.env, "NODE_ENV", {
      value: "production",
      configurable: true,
    });
    try {
      const request = buildTwilioRequest({
        url: "http://internal.local/api/twilio/voice",
        params: PARAMS,
      });
      expect(await verifyTwilioRequest(request)).toEqual({
        ok: false,
        code: "NOT_CONFIGURED",
      });
    } finally {
      Object.defineProperty(process.env, "NODE_ENV", {
        value: prev,
        configurable: true,
      });
    }
  });

  it("allows unsigned requests only with an explicit non-production flag", async () => {
    process.env.TWILIO_ALLOW_UNSIGNED = "true";
    const request = buildTwilioRequest({
      url: "http://internal.local/api/twilio/voice",
      params: PARAMS,
    });
    expect(await verifyTwilioRequest(request)).toEqual({
      ok: true,
      params: PARAMS,
    });
  });

  it("does not allow unsigned requests merely because no token is set", async () => {
    const request = buildTwilioRequest({
      url: "http://internal.local/api/twilio/voice",
      params: PARAMS,
    });
    expect(await verifyTwilioRequest(request)).toEqual({
      ok: false,
      code: "NOT_CONFIGURED",
    });
  });

  it("validates a request reconstructed from forwarded proxy headers", async () => {
    process.env.TWILIO_AUTH_TOKEN = TOKEN;
    const reconstructed = `${BASE}/api/twilio/gather`;
    const signature = signTwilioRequest({
      authToken: TOKEN,
      url: reconstructed,
      params: PARAMS,
    });
    const request = buildTwilioRequest({
      url: "http://10.0.0.9/api/twilio/gather",
      params: PARAMS,
      signature,
      headers: {
        "x-forwarded-proto": "https",
        "x-forwarded-host": "app.example.com",
      },
    });
    expect(await verifyTwilioRequest(request)).toMatchObject({ ok: true });
  });

  it("ignores spoofed forwarded headers when the base URL is pinned", async () => {
    process.env.TWILIO_AUTH_TOKEN = TOKEN;
    process.env.TWILIO_PUBLIC_BASE_URL = BASE;
    const signature = signTwilioRequest({
      authToken: TOKEN,
      url: `${BASE}/api/twilio/voice`,
      params: PARAMS,
    });
    const request = buildTwilioRequest({
      url: "http://internal.local/api/twilio/voice",
      params: PARAMS,
      signature,
      headers: { "x-forwarded-host": "attacker.example" },
    });
    expect(await verifyTwilioRequest(request)).toMatchObject({ ok: true });
  });

  it("includes query parameters in signing and rejects query tampering", async () => {
    process.env.TWILIO_AUTH_TOKEN = TOKEN;
    process.env.TWILIO_PUBLIC_BASE_URL = BASE;
    const signature = signTwilioRequest({
      authToken: TOKEN,
      url: `${BASE}/api/twilio/voice?Region=us1`,
      params: PARAMS,
    });
    const valid = buildTwilioRequest({
      url: "http://internal.local/api/twilio/voice?Region=us1",
      params: PARAMS,
      signature,
    });
    expect(await verifyTwilioRequest(valid)).toMatchObject({ ok: true });

    const tampered = buildTwilioRequest({
      url: "http://internal.local/api/twilio/voice?Region=eu1",
      params: PARAMS,
      signature,
    });
    expect(await verifyTwilioRequest(tampered)).toEqual({
      ok: false,
      code: "INVALID_SIGNATURE",
    });
  });

  it("rejects body tampering of form-encoded params", async () => {
    process.env.TWILIO_AUTH_TOKEN = TOKEN;
    process.env.TWILIO_PUBLIC_BASE_URL = BASE;
    const signature = signTwilioRequest({
      authToken: TOKEN,
      url: `${BASE}/api/twilio/gather`,
      params: PARAMS,
    });
    const request = buildTwilioRequest({
      url: "http://internal.local/api/twilio/gather",
      params: { ...PARAMS, Digits: "9" },
      signature,
    });
    expect(await verifyTwilioRequest(request)).toEqual({
      ok: false,
      code: "INVALID_SIGNATURE",
    });
  });

  it("rejects an unexpected content type that does not match the signed body", async () => {
    process.env.TWILIO_AUTH_TOKEN = TOKEN;
    process.env.TWILIO_PUBLIC_BASE_URL = BASE;
    const signature = signTwilioRequest({
      authToken: TOKEN,
      url: `${BASE}/api/twilio/voice`,
      params: PARAMS,
    });
    const request = buildTwilioRequest({
      url: "http://internal.local/api/twilio/voice",
      params: PARAMS,
      signature,
      contentType: "application/json",
      body: JSON.stringify(PARAMS),
    });
    expect(await verifyTwilioRequest(request)).toEqual({
      ok: false,
      code: "INVALID_SIGNATURE",
    });
  });

  it("logs only a coarse failure code, never the token, signature, or URL", async () => {
    process.env.TWILIO_AUTH_TOKEN = TOKEN;
    process.env.TWILIO_PUBLIC_BASE_URL = BASE;
    const events: AuditEvent[] = [];
    setAuditSinkForTests((event) => events.push(event));
    const request = buildTwilioRequest({
      url: "http://internal.local/api/twilio/voice",
      params: PARAMS,
      signature: "wrong-signature-value",
    });
    await verifyTwilioRequest(request);

    const serialized = JSON.stringify(events);
    expect(events.some((e) => e.code === "INVALID_SIGNATURE")).toBe(true);
    expect(serialized).not.toContain(TOKEN);
    expect(serialized).not.toContain("wrong-signature-value");
    expect(serialized).not.toContain("app.example.com");
  });
});
