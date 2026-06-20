import { NextResponse } from "next/server";
import { getRepositories } from "@/lib/repository/factory";
import { logSecurityEvent } from "@/lib/observability/logger";
import { rateLimit, rateLimitKeyFromRequest } from "@/lib/security/rate-limit";

function isAuthorized(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  return request.headers.get("authorization") === `Bearer ${secret}`;
}

export async function POST(request: Request) {
  if (!process.env.CRON_SECRET) {
    return NextResponse.json(
      { ok: false },
      { status: 404, headers: { "Cache-Control": "no-store" } },
    );
  }
  if (!isAuthorized(request)) {
    const limited = rateLimit({
      name: "cron-expire-unauthorized",
      key: rateLimitKeyFromRequest(request, "cron-expire"),
      limit: 10,
      windowMs: 60_000,
    });
    if (!limited.allowed) {
      logSecurityEvent({
        route: "/api/cron/expire",
        outcome: "rate_limited",
        code: "RATE_LIMITED",
      });
      return NextResponse.json(
        { ok: false },
        {
          status: 429,
          headers: {
            "Cache-Control": "no-store",
            "Retry-After": String(limited.retryAfterSeconds),
          },
        },
      );
    }
    return NextResponse.json(
      { ok: false },
      { status: 401, headers: { "Cache-Control": "no-store" } },
    );
  }

  const result = await getRepositories().expiry.expirePendingChecks();
  return NextResponse.json(
    { ok: true, ...result },
    { headers: { "Cache-Control": "no-store" } },
  );
}
