import { describe, expect, it } from "vitest";
import { validateTwilioSignature } from "./twilio-signature";
import { signTwilioRequest } from "./twilio-test-helpers";

const authToken = "test-auth-token-aaaaaaaaaaaaaaaaaaaa";
const url = "https://app.example.com/api/twilio/voice";
const params = { CallSid: "CA123", From: "+15551230000", Digits: "1" };

describe("validateTwilioSignature", () => {
  it("accepts a correctly computed signature", () => {
    const signature = signTwilioRequest({ authToken, url, params });
    expect(validateTwilioSignature({ authToken, signature, url, params })).toBe(
      true,
    );
  });

  it("rejects a tampered signature", () => {
    const signature = signTwilioRequest({ authToken, url, params });
    expect(
      validateTwilioSignature({
        authToken,
        signature: `${signature.slice(0, -2)}xy`,
        url,
        params,
      }),
    ).toBe(false);
  });

  it("rejects a null or empty signature", () => {
    expect(
      validateTwilioSignature({ authToken, signature: null, url, params }),
    ).toBe(false);
    expect(
      validateTwilioSignature({ authToken, signature: "", url, params }),
    ).toBe(false);
  });

  it("rejects when the auth token is empty (never fails open)", () => {
    const signature = signTwilioRequest({ authToken, url, params });
    expect(
      validateTwilioSignature({ authToken: "", signature, url, params }),
    ).toBe(false);
  });

  it("rejects when params are tampered after signing", () => {
    const signature = signTwilioRequest({ authToken, url, params });
    expect(
      validateTwilioSignature({
        authToken,
        signature,
        url,
        params: { ...params, Digits: "9" },
      }),
    ).toBe(false);
  });

  it("rejects when the URL is tampered after signing", () => {
    const signature = signTwilioRequest({ authToken, url, params });
    expect(
      validateTwilioSignature({
        authToken,
        signature,
        url: `${url}?evil=1`,
        params,
      }),
    ).toBe(false);
  });
});
