import { NextResponse } from "next/server";
import { getRepositories } from "@/lib/repository/factory";

export async function POST() {
  const reset = getRepositories().resetDemo;
  if (!reset) {
    return NextResponse.json(
      { error: "Demo reset is unavailable." },
      { status: 404 },
    );
  }
  await reset();
  return NextResponse.json({ ok: true });
}
