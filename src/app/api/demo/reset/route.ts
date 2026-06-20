import { getRepositories } from "@/lib/repository/factory";
import { getRuntimeConfig } from "@/lib/runtime-config";
import { executeDemoReset } from "@/lib/demo/reset";
import { logSecurityEvent } from "@/lib/observability/logger";
import { rateLimit, rateLimitKeyFromRequest } from "@/lib/security/rate-limit";

export async function POST(request: Request) {
  const limited = rateLimit({
    name: "demo-reset",
    key: rateLimitKeyFromRequest(request, "demo-reset"),
    limit: 5,
    windowMs: 60_000,
  });
  if (!limited.allowed) {
    logSecurityEvent({
      route: "/api/demo/reset",
      outcome: "rate_limited",
      code: "RATE_LIMITED",
    });
    return Response.json(
      { error: "Request unavailable." },
      {
        status: 429,
        headers: {
          "Cache-Control": "no-store",
          "Retry-After": String(limited.retryAfterSeconds),
        },
      },
    );
  }
  return executeDemoReset({
    runtime: getRuntimeConfig(),
    requestOrigin: request.headers.get("origin"),
    repositories: getRepositories,
  });
}
