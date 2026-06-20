import { NextResponse } from "next/server";
import { getRepositories } from "@/lib/repository/factory";
import { logSecurityEvent } from "@/lib/observability/logger";
import { rateLimit, rateLimitKeyFromRequest } from "@/lib/security/rate-limit";
import { TOKEN_PATTERN } from "@/lib/security/tokens";

const unavailable = { error: "Request unavailable." } as const;

export async function GET(request: Request) {
  const limited = rateLimit({
    name: "verification-context",
    key: rateLimitKeyFromRequest(request, "verification-context"),
    limit: 60,
    windowMs: 60_000,
  });
  if (!limited.allowed) {
    logSecurityEvent({
      route: "/api/verification/context",
      outcome: "rate_limited",
      code: "RATE_LIMITED",
    });
    return NextResponse.json(unavailable, {
      status: 429,
      headers: {
        "Cache-Control": "no-store",
        "Retry-After": String(limited.retryAfterSeconds),
      },
    });
  }

  const token = new URL(request.url).searchParams.get("token") ?? "";
  if (!TOKEN_PATTERN.test(token)) {
    logSecurityEvent({
      route: "/api/verification/context",
      outcome: "failure",
      code: "INVALID_INPUT",
    });
    return NextResponse.json(unavailable, {
      status: 404,
      headers: { "Cache-Control": "no-store" },
    });
  }
  const context =
    await getRepositories().verificationRequests.getContext(token);
  if (!context) {
    logSecurityEvent({
      route: "/api/verification/context",
      outcome: "failure",
      code: "UNAVAILABLE",
    });
    return NextResponse.json(unavailable, {
      status: 404,
      headers: { "Cache-Control": "no-store" },
    });
  }
  logSecurityEvent({
    route: "/api/verification/context",
    outcome: "success",
  });
  return NextResponse.json(context, {
    headers: { "Cache-Control": "no-store" },
  });
}
