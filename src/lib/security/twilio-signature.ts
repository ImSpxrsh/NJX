import "server-only";
import twilio from "twilio";

/**
 * Low-level Twilio signature check. Pure: it reads no environment and never
 * fails open. It returns true only when a non-empty signature cryptographically
 * matches the supplied URL and params under the given auth token.
 *
 * Mode decisions (whether a missing token/signature is tolerable) live in
 * {@link verifyTwilioRequest}, not here, so this function cannot be the source of
 * an accidental bypass.
 */
export function validateTwilioSignature(input: {
  authToken: string;
  signature: string | null;
  url: string;
  params: Record<string, string>;
}): boolean {
  if (!input.authToken || !input.signature) return false;
  return twilio.validateRequest(
    input.authToken,
    input.signature,
    input.url,
    input.params,
  );
}
