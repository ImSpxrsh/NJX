import { NextResponse } from "next/server";
import { FixtureEvidenceExtractor } from "@/lib/evidence/fixture-extractor";
import { LlmEvidenceExtractor } from "@/lib/evidence/llm-extractor";
import { evaluatePolicy } from "@/lib/policy/evaluate-policy";
import { getRepositories } from "@/lib/repository/factory";
import { getRuntimeConfig } from "@/lib/runtime-config";
import { serializeAnalyzeResponse } from "@/lib/api/analyze-response";
import { analyzeRequestSchema } from "@/lib/api/analyze-request";
import type { AnalyzeResponse } from "@/types/api";

export async function POST(request: Request) {
  const parsed = analyzeRequestSchema.safeParse(
    await request.json().catch(() => null),
  );
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
  return NextResponse.json(response, {
    headers: { "Cache-Control": "no-store" },
  });
}
