import { NextResponse } from "next/server";
import { z } from "zod";
import { getRepositories } from "@/lib/repository/factory";
import { logSecurityEvent } from "@/lib/observability/logger";
import { rateLimit, rateLimitKeyFromRequest } from "@/lib/security/rate-limit";
import { TOKEN_PATTERN } from "@/lib/security/tokens";

const inputSchema = z
  .object({
    token: z.string().regex(TOKEN_PATTERN),
    response: z.enum(["CONFIRMED_MINE", "DENIED_MINE", "CALL_ME"]),
  })
  .strict();

const rejectedResponse = {
  ok: false,
  code: "REJECTED",
  message: "Verification response was not accepted.",
} as const;

export async function POST(request: Request) {
  const limited = rateLimit({
    name: "verification-respond",
    key: rateLimitKeyFromRequest(request, "verification-respond"),
    limit: 20,
    windowMs: 60_000,
  });
  if (!limited.allowed) {
    logSecurityEvent({
      route: "/api/verification/respond",
      outcome: "rate_limited",
      code: "RATE_LIMITED",
    });
    return NextResponse.json(rejectedResponse, {
      status: 429,
      headers: {
        "Cache-Control": "no-store",
        "Retry-After": String(limited.retryAfterSeconds),
      },
    });
  }

  const parsed = inputSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    logSecurityEvent({
      route: "/api/verification/respond",
      outcome: "failure",
      code: "INVALID_INPUT",
    });
    return NextResponse.json(rejectedResponse, {
      status: 400,
      headers: { "Cache-Control": "no-store" },
    });
  }
  const result = await getRepositories().verificationRequests.respond(
    parsed.data.token,
    parsed.data.response,
  );
  logSecurityEvent({
    route: "/api/verification/respond",
    outcome: result.ok ? "success" : "failure",
    code: result.ok ? result.state : result.code,
  });
  return NextResponse.json(result.ok ? result : rejectedResponse, {
    status: result.ok ? 200 : 409,
    headers: { "Cache-Control": "no-store" },
  });
}
