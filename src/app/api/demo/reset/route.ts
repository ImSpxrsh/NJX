import { NextResponse } from "next/server";
import { getRepositories } from "@/lib/repository/factory";
import { getRuntimeConfig } from "@/lib/runtime-mode";

export async function POST() {
  // Reject before any database access if demo mode is not explicitly enabled.
  // This makes the endpoint unavailable in production regardless of which
  // repository implementation is wired up.
  if (!getRuntimeConfig().isDemo) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }

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
