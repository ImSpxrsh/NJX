import { NextResponse } from "next/server";
import twilio from "twilio";
import { logSecurityEvent } from "@/lib/observability/logger";
import { rateLimit } from "@/lib/security/rate-limit";
import { verifyTwilioRequest } from "@/lib/security/twilio-webhook";

export async function POST(request: Request) {
  const verification = await verifyTwilioRequest(request);
  if (!verification.ok) {
    // Generic response regardless of failure code (missing, invalid, or not
    // configured) so the boundary reveals nothing.
    return new NextResponse("Forbidden", { status: 403 });
  }
  const limited = rateLimit({
    name: "twilio-voice",
    key: `${verification.params.CallSid ?? "missing-call"}:${verification.params.From ?? "unknown-caller"}`,
    limit: 10,
    windowMs: 60_000,
  });
  if (!limited.allowed) {
    logSecurityEvent({
      route: "/api/twilio/voice",
      outcome: "rate_limited",
      provider: "twilio",
      code: "RATE_LIMITED",
    });
    const response = new twilio.twiml.VoiceResponse();
    response.say("Please hang up and call a number you know.");
    return new NextResponse(response.toString(), {
      status: 429,
      headers: {
        "Content-Type": "text/xml",
        "Retry-After": String(limited.retryAfterSeconds),
      },
    });
  }
  const response = new twilio.twiml.VoiceResponse();
  const gather = response.gather({
    numDigits: 1,
    action: "/api/twilio/gather",
    method: "POST",
    timeout: 8,
  });
  gather.say(
    "If someone is asking for money, gift cards, a password, or a verification code, press 1.",
  );
  response.say(
    "No selection was received. Hang up and call a number you know.",
  );
  return new NextResponse(response.toString(), {
    headers: { "Content-Type": "text/xml" },
  });
}
