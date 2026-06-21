import { NextResponse } from "next/server";
import { FixtureEvidenceExtractor } from "@/lib/evidence/fixture-extractor";
import { LlmEvidenceExtractor } from "@/lib/evidence/llm-extractor";
import { evaluatePolicy } from "@/lib/policy/evaluate-policy";
import { getRepositories } from "@/lib/repository/factory";
import { getRuntimeConfig } from "@/lib/runtime-config";
import { serializeAnalyzeResponse } from "@/lib/api/analyze-response";
import { analyzeRequestSchema } from "@/lib/api/analyze-request";
import { logSecurityEvent } from "@/lib/observability/logger";
import { rateLimit, rateLimitKeyFromRequest } from "@/lib/security/rate-limit";
import type { AnalyzeResponse } from "@/types/api";

export async function POST(request: Request) {
  const startedAt = Date.now();
  const limited = rateLimit({
    name: "api-analyze",
    key: rateLimitKeyFromRequest(request, "analyze"),
    limit: 30,
    windowMs: 60_000,
  });
  if (!limited.allowed) {
    logSecurityEvent({
      route: "/api/analyze",
      outcome: "rate_limited",
      code: "RATE_LIMITED",
      durationMs: Date.now() - startedAt,
    });
    return NextResponse.json(
      { error: "Too many requests. Try again later." },
      {
        status: 429,
        headers: {
          "Cache-Control": "no-store",
          "Retry-After": String(limited.retryAfterSeconds),
        },
      },
    );
  }

  const parsed = analyzeRequestSchema.safeParse(
    await request.json().catch(() => null),
  );
  if (!parsed.success) {
    logSecurityEvent({
      route: "/api/analyze",
      outcome: "failure",
      code: "INVALID_INPUT",
      durationMs: Date.now() - startedAt,
    });
    return NextResponse.json(
      { error: "Enter a message of 4,000 characters or fewer." },
      { status: 400 },
    );
  }
  const requestId = crypto.randomUUID();
  const extractor =
    parsed.data.mode === "llm"
      ? new LlmEvidenceExtractor()
      : new FixtureEvidenceExtractor();

  const extraction = await extractor.extract({
    text: parsed.data.message,
    requestId,
  });
  const decision = evaluatePolicy(extraction);
  const repositories = getRepositories();
  const { check, verification } = await repositories.checks.create({
    householdId: parsed.data.householdId,
    source: "web",
    extraction,
    decision,
  });

  const appUrl = process.env.PUBLIC_APP_URL ?? new URL(request.url).origin;
  if (verification?.rawToken) {
    await repositories.verificationNotifications
      .sendVerificationLink({
        requestId: verification.requestId,
        rawToken: verification.rawToken,
        appUrl,
      })
      .catch(() => null);
  }
  const response: AnalyzeResponse = serializeAnalyzeResponse(
    getRuntimeConfig(),
    {
      checkId: check.id,
      state: check.state as "PAUSED" | "PENDING",
      extraction,
      decision,
      verification,
    },
  );
  logSecurityEvent({
    route: "/api/analyze",
    outcome: "success",
    requestId,
    checkId: check.id,
    level: decision.level,
    durationMs: Date.now() - startedAt,
  });
  return NextResponse.json(response, {
    headers: { "Cache-Control": "no-store" },
  });
}
