import { NextResponse } from "next/server";
import { z } from "zod";
import { getRepositories } from "@/lib/repository/factory";
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
  const parsed = inputSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(rejectedResponse, { status: 400 });
  }
  const result = await getRepositories().verificationRequests.respond(
    parsed.data.token,
    parsed.data.response,
  );
  return NextResponse.json(result.ok ? result : rejectedResponse, {
    status: result.ok ? 200 : 409,
    headers: { "Cache-Control": "no-store" },
  });
}
