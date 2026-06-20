import { NextResponse } from "next/server";
import { z } from "zod";
import { getRepositories } from "@/lib/repository/factory";
import type { EnrollmentStatusResponse } from "@/types/api";

const querySchema = z.string().uuid();

export async function GET(request: Request) {
  const id = new URL(request.url).searchParams.get("trustedContactId") ?? "";
  if (!querySchema.safeParse(id).success) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }
  const status = await getRepositories().enrollmentVerifications.getStatus(id);
  if (!status) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }
  const body: EnrollmentStatusResponse = status;
  return NextResponse.json(body, {
    headers: { "Cache-Control": "no-store" },
  });
}
