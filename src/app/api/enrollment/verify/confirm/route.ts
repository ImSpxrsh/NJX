import { NextResponse } from "next/server";
import { z } from "zod";
import { getRepositories } from "@/lib/repository/factory";
import { networkHint } from "@/lib/enrollment/request-context";
import {
  ENROLLMENT_CODE_PATTERN,
  ENROLLMENT_LINK_PATTERN,
} from "@/lib/security/enrollment-tokens";
import type { EnrollmentConfirmResponse } from "@/types/api";

// Either an email link token or an SMS code for a specific contact.
const inputSchema = z.union([
  z.object({ token: z.string().regex(ENROLLMENT_LINK_PATTERN) }).strict(),
  z
    .object({
      trustedContactId: z.string().uuid(),
      code: z.string().regex(ENROLLMENT_CODE_PATTERN),
    })
    .strict(),
]);

const noStore = { "Cache-Control": "no-store" } as const;

export async function POST(request: Request) {
  const parsed = inputSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    // Malformed input is the same generic failure as a wrong secret.
    return NextResponse.json(
      { ok: false } satisfies EnrollmentConfirmResponse,
      { status: 409, headers: noStore },
    );
  }
  const enrollment = getRepositories().enrollmentVerifications;
  const factors = { networkHint: networkHint(request) };
  const result =
    "token" in parsed.data
      ? await enrollment.confirmByToken(parsed.data.token, factors)
      : await enrollment.confirmByCode(
          parsed.data.trustedContactId,
          parsed.data.code,
          factors,
        );

  if (result.ok) {
    return NextResponse.json({ ok: true } satisfies EnrollmentConfirmResponse, {
      headers: noStore,
    });
  }
  // 429 only signals throttling; every other failure is an indistinguishable
  // generic 409 that reveals nothing about token validity or enrollment state.
  return NextResponse.json({ ok: false } satisfies EnrollmentConfirmResponse, {
    status: result.code === "RATE_LIMITED" ? 429 : 409,
    headers: noStore,
  });
}
