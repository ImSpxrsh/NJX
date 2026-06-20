import twilio from "twilio";

/**
 * Test-only helpers for constructing Twilio webhook requests and computing the
 * signatures Twilio would send. `getExpectedTwilioSignature` is the same routine
 * `validateRequest` verifies against, so fixtures match production exactly.
 */
export function signTwilioRequest(input: {
  authToken: string;
  url: string;
  params: Record<string, string>;
}): string {
  return twilio.getExpectedTwilioSignature(
    input.authToken,
    input.url,
    input.params,
  );
}

export function formBody(params: Record<string, string>): string {
  return new URLSearchParams(params).toString();
}

export function buildTwilioRequest(input: {
  /** The URL the Request object reports as `request.url`. */
  url: string;
  params: Record<string, string>;
  /** Omit for a request with no signature header. */
  signature?: string;
  headers?: Record<string, string>;
  contentType?: string;
  body?: string;
}): Request {
  const headers = new Headers(input.headers);
  headers.set(
    "content-type",
    input.contentType ?? "application/x-www-form-urlencoded",
  );
  if (input.signature !== undefined) {
    headers.set("x-twilio-signature", input.signature);
  }
  return new Request(input.url, {
    method: "POST",
    headers,
    body: input.body ?? formBody(input.params),
  });
}
