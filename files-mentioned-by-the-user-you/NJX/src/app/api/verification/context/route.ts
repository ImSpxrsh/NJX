import { NextResponse } from "next/server";
import { getRepositories } from "@/lib/repository/factory";

export async function GET(request: Request) {
  const token = new URL(request.url).searchParams.get("token") ?? "";
  const context =
    await getRepositories().verificationRequests.getContext(token);
  if (!context) {
    return NextResponse.json({ error: "Link not found." }, { status: 404 });
  }
  return NextResponse.json(context, {
    headers: { "Cache-Control": "no-store" },
  });
}
