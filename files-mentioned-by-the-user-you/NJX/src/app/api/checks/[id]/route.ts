import { NextResponse } from "next/server";
import { getRepositories } from "@/lib/repository/factory";
import type { CheckStatusResponse } from "@/types/api";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const check = await getRepositories().checks.getPublicById(id);
  if (!check) {
    return NextResponse.json({ error: "Check not found." }, { status: 404 });
  }
  const response: CheckStatusResponse = {
    checkId: check.id,
    state: check.state,
    level: check.verificationLevel,
    summary: check.sanitizedSummary,
    requestedAction: check.requestedAction,
    policyReasons: check.policyReasons,
    contactResponseStatus:
      check.state === "PENDING"
        ? "No response has been received."
        : check.state === "VERIFIED"
          ? "The enrolled contact confirmed this request."
          : check.state === "DENIED"
            ? "The enrolled contact denied making this request."
            : check.state === "EXPIRED"
              ? "The verification request expired without approval."
              : "A trusted-contact response was not required.",
    expiresAt: check.expiresAt,
    statusSource: check.statusSource,
    signals: check.signals,
  };
  return NextResponse.json(response, {
    headers: { "Cache-Control": "no-store" },
  });
}
