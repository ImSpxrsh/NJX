import { NextResponse } from "next/server";
import { z } from "zod";
import { FixtureEvidenceExtractor } from "@/lib/evidence/fixture-extractor";
import { LlmEvidenceExtractor } from "@/lib/evidence/llm-extractor";
import { evaluatePolicy } from "@/lib/policy/evaluate-policy";
import { getRepositories } from "@/lib/repository/factory";
import { getRuntimeConfig } from "@/lib/runtime-mode";

const inputSchema = z
  .object({
    householdId: z.string().uuid(),
    message: z.string().trim().min(1).max(4_000),
    mode: z.enum(["fixture", "llm"]).optional(),
  })
  .strict();

// Production response schema — strict so that any accidental demo-only field
// causes a parse error rather than leaking to the client.
const productionVerificationSchema = z
  .object({
    requestId: z.string().uuid(),
    expiresAt: z.string(),
  })
  .strict();

const productionResponseSchema = z
  .object({
    checkId: z.string().uuid(),
    state: z.enum(["PAUSED", "PENDING"]),
    extraction: z.unknown(),
    decision: z.unknown(),
    verification: productionVerificationSchema.optional(),
  })
  .strict();

// Demo response extends production with the simulated contact URL.
// This schema is only used when CIRCLECHECK_REPOSITORY_MODE=demo.
const demoResponseSchema = productionResponseSchema
  .omit({ verification: true })
  .extend({
    verification: productionVerificationSchema.optional(),
    demoContactUrl: z.string().url(),
  });

export async function POST(request: Request) {
  // Runtime mode is resolved from server-side environment configuration only.
  // Client-supplied data (query params, headers, body, cookies) cannot affect it.
  const runtime = getRuntimeConfig();

  const parsed = inputSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Enter a message of 4,000 characters or fewer." },
      { status: 400 },
    );
  }

  const extractor =
    parsed.data.mode === "llm"
      ? new LlmEvidenceExtractor()
      : new FixtureEvidenceExtractor();

  const extraction = await extractor.extract({
    text: parsed.data.message,
    requestId: crypto.randomUUID(),
  });
  const decision = evaluatePolicy(extraction);
  const repositories = getRepositories();
  const { check, verification } = await repositories.checks.create({
    householdId: parsed.data.householdId,
    source: "web",
    extraction,
    decision,
  });

  // Base response contains no verification tokens or demo-only fields.
  const safeBase = {
    checkId: check.id,
    state: check.state as "PAUSED" | "PENDING",
    extraction,
    decision,
    ...(verification
      ? {
          verification: {
            requestId: verification.requestId,
            expiresAt: verification.expiresAt,
          },
        }
      : {}),
  };

  // Demo branch: only reachable in an explicitly enabled demo deployment.
  // Production never executes this branch.
  if (runtime.isDemo && verification?.rawToken) {
    const appUrl =
      process.env.PUBLIC_APP_URL ?? new URL(request.url).origin;
    return NextResponse.json(
      demoResponseSchema.parse({
        ...safeBase,
        demoContactUrl: `${appUrl}/verify/${verification.rawToken}`,
      }),
      { headers: { "Cache-Control": "no-store" } },
    );
  }

  // Production branch: strict schema prevents any demo field from appearing.
  return NextResponse.json(productionResponseSchema.parse(safeBase), {
    headers: { "Cache-Control": "no-store" },
  });
}
