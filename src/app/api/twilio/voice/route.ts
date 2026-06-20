import { NextResponse } from "next/server";
import twilio from "twilio";
import { validateTwilioRequest } from "@/lib/security/twilio-signature";
import { parseTwilioParams } from "@/lib/security/twilio-request";

export async function POST(request: Request) {
  const params = await parseTwilioParams(request);
  if (
    !validateTwilioRequest({
      signature: request.headers.get("x-twilio-signature"),
      url: request.url,
      params,
    })
  ) {
    return new NextResponse("Invalid signature", { status: 403 });
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
