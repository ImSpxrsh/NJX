import { NextResponse } from "next/server";
import twilio from "twilio";
import { verifyTwilioRequest } from "@/lib/security/twilio-webhook";

export async function POST(request: Request) {
  const verification = await verifyTwilioRequest(request);
  if (!verification.ok) {
    // Generic response regardless of failure code (missing, invalid, or not
    // configured) so the boundary reveals nothing.
    return new NextResponse("Forbidden", { status: 403 });
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
