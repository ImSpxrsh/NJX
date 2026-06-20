import { NextResponse } from "next/server";
import { z } from "zod";
import { respondToVerification } from "@/lib/repository/demo-store";
import { TOKEN_PATTERN } from "@/lib/security/tokens";

const inputSchema = z
  .object({
    token: z.string().regex(TOKEN_PATTERN),
    response: z.enum(["CONFIRMED_MINE", "DENIED_MINE", "CALL_ME"]),
  })
  .strict();

export async function POST(request: Request) {
  const parsed = inputSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid response." }, { status: 400 });
  }
  const result = respondToVerification(parsed.data.token, parsed.data.response);
  return NextResponse.json(result, {
    status: result.ok ? 200 : result.code === "EXPIRED" ? 410 : 409,
    headers: { "Cache-Control": "no-store" },
  });
}
