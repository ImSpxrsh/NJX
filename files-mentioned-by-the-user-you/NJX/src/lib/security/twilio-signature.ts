import "server-only";
import twilio from "twilio";

export function validateTwilioRequest(input: {
  signature: string | null;
  url: string;
  params: Record<string, string>;
}): boolean {
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  if (!authToken) return true;
  if (!input.signature) return false;
  return twilio.validateRequest(
    authToken,
    input.signature,
    input.url,
    input.params,
  );
}
