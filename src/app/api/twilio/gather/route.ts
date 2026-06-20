import { NextResponse } from "next/server";
import twilio from "twilio";
import { verifyTwilioRequest } from "@/lib/security/twilio-webhook";
import { FixtureEvidenceExtractor } from "@/lib/evidence/fixture-extractor";
import { evaluatePolicy } from "@/lib/policy/evaluate-policy";
import { getRepositories } from "@/lib/repository/factory";

export async function POST(request: Request) {
  const verification = await verifyTwilioRequest(request);
  if (!verification.ok) {
    // Generic response: no processing, no trust-state change on any failure.
    return new NextResponse("Forbidden", { status: 403 });
  }
  const params = verification.params;
  const response = new twilio.twiml.VoiceResponse();
  if (params.Digits !== "1") {
    response.say(
      "No alert was created. Hang up and call the trusted number printed on your CircleCheck card.",
    );
    return new NextResponse(response.toString(), {
      headers: { "Content-Type": "text/xml" },
    });
  }
  const callSid = params.CallSid ?? "missing-call-id";
  const repositories = getRepositories();
  const appUrl = process.env.PUBLIC_APP_URL ?? new URL(request.url).origin;
  const callerRoute = await repositories.phoneAlerts.resolveHouseholdForCaller(
    params.From,
  );
  if (callerRoute && (await repositories.phoneAlerts.registerCall(callSid))) {
    const extraction = await new FixtureEvidenceExtractor().extract({
      text: "Urgent phone alert involving money, gift cards, a password, or a verification code.",
      requestId: crypto.randomUUID(),
    });
    const created = await repositories.checks.create({
      householdId: callerRoute.householdId,
      extraction,
      decision: {
        ...evaluatePolicy(extraction),
        level: "L3",
        verificationRequired: true,
        requiredAction: "MANDATORY_HOLD_AND_VERIFY",
      },
      source: "phone",
    });
    await repositories.phoneAlerts.recordAlert({
      callSid,
      householdId: callerRoute.householdId,
      checkId: created.check.id,
      verificationRequestId: created.verification?.requestId ?? "",
      pressedDigit: "1",
    });
    if (created.verification?.rawToken) {
      await repositories.verificationNotifications
        .sendVerificationLink({
          requestId: created.verification.requestId,
          rawToken: created.verification.rawToken,
          appUrl,
        })
        .catch(() => null);
    }
  }
  response.say(
    "Do not send anything yet. Hang up and call the trusted number printed on your CircleCheck card.",
  );
  return new NextResponse(response.toString(), {
    headers: { "Content-Type": "text/xml" },
  });
}
