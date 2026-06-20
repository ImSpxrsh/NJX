import { NextResponse } from "next/server";
import { z } from "zod";
import { FixtureEvidenceExtractor } from "@/lib/evidence/fixture-extractor";
import { LlmEvidenceExtractor } from "@/lib/evidence/llm-extractor";
import { evaluatePolicy } from "@/lib/policy/evaluate-policy";
import { getRepositories } from "@/lib/repository/factory";
import type { AnalyzeResponse } from "@/types/api";

const inputSchema = z
  .object({
    householdId: z.string().uuid(),
    message: z.string().trim().min(1).max(4_000),
    mode: z.enum(["fixture", "llm"]).optional(),
  })
  .strict();

export async function POST(request: Request) {
  const parsed = inputSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
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
  const response: AnalyzeResponse = {
    checkId: check.id,
    state: check.state as "PAUSED" | "PENDING",
    extraction,
    decision,
    ...(verification
      ? {
          verification: {
            requestId: verification.requestId,
            expiresAt: verification.expiresAt,
            demoContactUrl: `${appUrl}/verify/${verification.rawToken}`,
          },
        }
      : {}),
  };
  return NextResponse.json(response, {
    headers: { "Cache-Control": "no-store" },
  });
}
