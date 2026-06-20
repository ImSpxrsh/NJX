import { NextResponse } from "next/server";
import { getVerificationContext } from "@/lib/repository/demo-store";

export async function GET(request: Request) {
  const token = new URL(request.url).searchParams.get("token") ?? "";
  const context = getVerificationContext(token);
  if (!context) {
    return NextResponse.json({ error: "Link not found." }, { status: 404 });
  }
  return NextResponse.json(context, {
    headers: { "Cache-Control": "no-store" },
  });
}
