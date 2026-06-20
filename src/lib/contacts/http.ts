import "server-only";
import { NextResponse } from "next/server";
import { ZodError, type ZodTypeAny, type z } from "zod";
import { ContactError } from "./errors";

const NO_STORE = { "Cache-Control": "no-store" } as const;

export function jsonOk<T>(body: T, status = 200): NextResponse {
  return NextResponse.json(body, { status, headers: NO_STORE });
}

/**
 * Parse and strictly validate a JSON request body. Throws ContactError on
 * malformed JSON or schema violations (including unknown fields, since the
 * contact schemas are `.strict()`), so a client cannot smuggle ownership or
 * verification fields.
 */
export async function parseBody<S extends ZodTypeAny>(
  request: Request,
  schema: S,
): Promise<z.infer<S>> {
  const raw = await request.json().catch(() => {
    throw new ContactError("VALIDATION", "Request body must be valid JSON.");
  });
  return schema.parse(raw);
}

/**
 * Run a route handler with uniform, fail-closed error mapping. Never leaks
 * internal error details to the client.
 */
export async function runRoute(
  handler: () => Promise<NextResponse>,
): Promise<NextResponse> {
  try {
    return await handler();
  } catch (error) {
    if (error instanceof ContactError) {
      return NextResponse.json(
        { error: { code: error.code, message: error.message } },
        { status: error.status, headers: NO_STORE },
      );
    }
    if (error instanceof ZodError) {
      return NextResponse.json(
        { error: { code: "VALIDATION", message: "Invalid request." } },
        { status: 422, headers: NO_STORE },
      );
    }
    // Unexpected: respond generically and fail closed.
    return NextResponse.json(
      { error: { code: "INTERNAL", message: "Unexpected error." } },
      { status: 500, headers: NO_STORE },
    );
  }
}
