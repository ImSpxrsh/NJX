import { NextResponse } from "next/server";
import { z } from "zod";
import { getRepositories } from "@/lib/repository/factory";
import {
  ENROLLMENT_DEMO_NOTICE,
  isEnrollmentDemoMode,
} from "@/lib/enrollment/demo-mode";
import { networkHint } from "@/lib/enrollment/request-context";
import type { EnrollmentStartResponse } from "@/types/api";

const inputSchema = z
  .object({
    householdId: z.string().uuid(),
    trustedContactId: z.string().uuid(),
  })
  .strict();

const noStore = { "Cache-Control": "no-store" } as const;

export async function POST(request: Request) {
  const parsed = inputSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }
  const demoMode = isEnrollmentDemoMode();
  const result = await getRepositories().enrollmentVerifications.start({
    householdId: parsed.data.householdId,
    trustedContactId: parsed.data.trustedContactId,
    requestId: crypto.randomUUID(),
    networkHint: networkHint(request),
  });

  if (!result.ok) {
    if (result.code === "RATE_LIMITED") {
      return NextResponse.json(
        { error: "Too many requests. Please try again later." },
        { status: 429, headers: noStore },
      );
    }
    // CONTACT_NOT_FOUND and INVALID_DESTINATION share a generic 400 so callers
    // cannot enumerate contacts or destination state.
    return NextResponse.json(
      { error: "Could not start destination verification." },
      { status: 400, headers: noStore },
    );
  }

  const body: EnrollmentStartResponse = {
    verificationId: result.verificationId,
    channel: result.channel,
    expiresAt: result.expiresAt,
    demoMode,
  };

  if (demoMode) {
    const appUrl = process.env.PUBLIC_APP_URL ?? new URL(request.url).origin;
    body.demo = {
      notice: ENROLLMENT_DEMO_NOTICE,
      channel: result.channel,
      ...(result.deliverySecret.kind === "code"
        ? { code: result.deliverySecret.code }
        : {
            verifyUrl: `${appUrl}/enroll/verify/${result.deliverySecret.rawToken}`,
          }),
    };
  }

  return NextResponse.json(body, { headers: noStore });
}
