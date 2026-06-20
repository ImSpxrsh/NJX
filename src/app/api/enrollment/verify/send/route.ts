import { NextResponse } from "next/server";
import { z } from "zod";
import { getRepositories } from "@/lib/repository/factory";
import {
  ENROLLMENT_DEMO_NOTICE,
  isEnrollmentDemoMode,
} from "@/lib/enrollment/demo-mode";
import { networkHint } from "@/lib/enrollment/request-context";
import { deliverEnrollmentVerification } from "@/lib/notification/enrollment-notifier";
import type { EnrollmentSendResponse } from "@/types/api";

const inputSchema = z
  .object({
    householdId: z.string().uuid(),
    trustedContactId: z.string().uuid(),
  })
  .strict();

const noStore = { "Cache-Control": "no-store" } as const;

/**
 * Issue an enrollment secret (CC-202) and deliver it via the provider-neutral
 * notification service (CC-203). Delivery failure leaves the destination
 * unverified and returns manual callback guidance; it never implies confirmation.
 */
export async function POST(request: Request) {
  const parsed = inputSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }
  const repositories = getRepositories();
  const started = await repositories.enrollmentVerifications.start({
    householdId: parsed.data.householdId,
    trustedContactId: parsed.data.trustedContactId,
    requestId: crypto.randomUUID(),
    networkHint: networkHint(request),
  });
  if (!started.ok) {
    if (started.code === "RATE_LIMITED") {
      return NextResponse.json(
        { error: "Too many requests. Please try again later." },
        { status: 429, headers: noStore },
      );
    }
    return NextResponse.json(
      { error: "Could not start destination verification." },
      { status: 400, headers: noStore },
    );
  }

  const contact = await repositories.trustedContacts.getInternalById(
    parsed.data.trustedContactId,
  );
  const destination =
    started.channel === "sms" ? contact?.phoneE164 : contact?.email;
  if (!destination) {
    // Should not happen (start validated the destination), but never imply
    // delivery occurred if it does.
    return NextResponse.json(
      { error: "Could not deliver the verification message." },
      { status: 400, headers: noStore },
    );
  }

  const appUrl = process.env.PUBLIC_APP_URL ?? new URL(request.url).origin;
  const delivery = await deliverEnrollmentVerification({
    verificationId: started.verificationId,
    channel: started.channel,
    destination,
    deliverySecret: started.deliverySecret,
    appUrl,
    requestId: crypto.randomUUID(),
  });

  const demoMode = isEnrollmentDemoMode();
  const body: EnrollmentSendResponse = {
    verificationId: started.verificationId,
    channel: started.channel,
    expiresAt: started.expiresAt,
    delivery: { status: delivery.status },
    demoMode,
    ...(delivery.status === "FAILED"
      ? { manualCallback: delivery.manualCallbackGuidance }
      : {}),
  };

  if (demoMode) {
    body.demo = {
      notice: ENROLLMENT_DEMO_NOTICE,
      channel: started.channel,
      ...(started.deliverySecret.kind === "code"
        ? { code: started.deliverySecret.code }
        : {
            verifyUrl: `${appUrl}/enroll/verify/${started.deliverySecret.rawToken}`,
          }),
    };
  }

  return NextResponse.json(body, { headers: noStore });
}
