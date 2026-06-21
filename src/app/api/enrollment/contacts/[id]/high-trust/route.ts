import { NextResponse } from "next/server";
import { z } from "zod";
import { getRepositories } from "@/lib/repository/factory";
import { toContactView } from "@/lib/enrollment/contact-view";
import type { HighTrustEligibilityResponse } from "@/types/api";

type Context = { params: Promise<{ id: string }> };

const noStore = { "Cache-Control": "no-store" } as const;

const inputSchema = z.object({ householdId: z.string().uuid() }).strict();

// High-trust gate (CC-101 requirement): a high-trust workflow may target a
// destination only when it has already completed destination verification.
// Unverified destinations are rejected (403). Fails closed.
export async function POST(request: Request, context: Context) {
  const { id } = await context.params;
  const parsed = inputSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: "A valid householdId is required." },
      { status: 400, headers: noStore },
    );
  }

  const contact = await getRepositories().trustedContacts.getInternalById(id);
  // Cross-household or unknown id is an indistinct 404.
  if (!contact || contact.householdId !== parsed.data.householdId) {
    return NextResponse.json(
      { error: "Contact not found." },
      { status: 404, headers: noStore },
    );
  }

  if (contact.destinationVerifiedAt === null) {
    return NextResponse.json(
      {
        error:
          "High-trust verification requires a verified destination.",
      },
      { status: 403, headers: noStore },
    );
  }

  const body: HighTrustEligibilityResponse = {
    eligible: true,
    contact: toContactView(contact),
  };
  return NextResponse.json(body, { headers: noStore });
}
