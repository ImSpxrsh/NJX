import "server-only";
import twilio from "twilio";
import type { DestinationVerificationChannel } from "@/types/domain";

// Outbound delivery of destination-verification one-time codes.
//
// SMS is wired through Twilio when credentials are configured. Email delivery is
// not yet wired (no provider is configured in this repo) and is a no-op seam.
//
// SECURITY: the plaintext code passes through here only to be delivered. It is
// never logged (invariant 13: secrets do not enter logs) and never persisted in
// plaintext (only its SHA-256 hash is stored).

export type DeliveryResult = { delivered: boolean; provider: string };

async function sendSms(toE164: string, code: string): Promise<DeliveryResult> {
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const from = process.env.TWILIO_PHONE_NUMBER;

  // Fail closed on misconfiguration in production; demo mode surfaces the code
  // via the API response instead of sending, so a missing client is expected
  // there and handled by the caller.
  if (!accountSid || !authToken || !from) {
    return { delivered: false, provider: "twilio:unconfigured" };
  }

  const client = twilio(accountSid, authToken);
  await client.messages.create({
    to: toE164,
    from,
    body: `Your CircleCheck verification code is ${code}. It expires shortly. Reply STOP to opt out.`,
  });
  return { delivered: true, provider: "twilio" };
}

async function sendEmail(): Promise<DeliveryResult> {
  // No email provider configured in this repo yet. Left as an explicit seam.
  return { delivered: false, provider: "email:unconfigured" };
}

export async function deliverDestinationCode(input: {
  channel: DestinationVerificationChannel;
  destination: string;
  code: string;
}): Promise<DeliveryResult> {
  if (input.channel === "sms") {
    return sendSms(input.destination, input.code);
  }
  return sendEmail();
}
