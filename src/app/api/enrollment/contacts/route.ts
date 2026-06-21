import { NextResponse } from "next/server";
import { z } from "zod";
import { getRepositories } from "@/lib/repository/factory";
import { toContactView } from "@/lib/enrollment/contact-view";
import type { ContactListResponse, CreateContactResponse } from "@/types/api";

const channel = z.enum(["sms", "email"]);

const createSchema = z
  .object({
    householdId: z.string().uuid(),
    displayName: z.string().trim().min(1).max(120),
    channel,
    destination: z.string().trim().min(1).max(254),
  })
  .strict();

const changeSchema = z
  .object({
    trustedContactId: z.string().uuid(),
    channel,
    destination: z.string().trim().min(1).max(254),
  })
  .strict();

const noStore = { "Cache-Control": "no-store" } as const;

// List a household's contacts (CC-201). The household is taken from the query
// and scoped at the repository; responses never include destination values.
export async function GET(request: Request) {
  const householdId = new URL(request.url).searchParams.get("householdId");
  if (!householdId || !z.string().uuid().safeParse(householdId).success) {
    return NextResponse.json(
      { error: "A valid householdId is required." },
      { status: 400, headers: noStore },
    );
  }
  const contacts =
    await getRepositories().trustedContacts.listForHousehold(householdId);
  const body: ContactListResponse = { contacts: contacts.map(toContactView) };
  return NextResponse.json(body, { headers: noStore });
}

export async function POST(request: Request) {
  const parsed = createSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid contact." }, { status: 400 });
  }
  const result = await getRepositories().enrollmentVerifications.createContact({
    householdId: parsed.data.householdId,
    displayName: parsed.data.displayName,
    channel: parsed.data.channel,
    destination: parsed.data.destination,
    requestId: crypto.randomUUID(),
  });
  if (!result.ok) {
    // The per-household cap is a distinct, non-sensitive throttle (429); an
    // invalid destination stays a generic 400.
    if (result.code === "LIMIT_EXCEEDED") {
      return NextResponse.json(
        { error: "This household has reached its destination limit." },
        { status: 429, headers: noStore },
      );
    }
    return NextResponse.json(
      { error: "That destination is not valid." },
      { status: 400, headers: noStore },
    );
  }
  const body: CreateContactResponse = {
    contactId: result.contact.id,
    channel: parsed.data.channel,
    destinationVerified: false,
  };
  return NextResponse.json(body, { status: 201, headers: noStore });
}

// Changing a destination always clears prior verification (re-verification
// required). It never returns the stored destination value.
export async function PUT(request: Request) {
  const parsed = changeSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid contact." }, { status: 400 });
  }
  const result =
    await getRepositories().enrollmentVerifications.changeDestination({
      trustedContactId: parsed.data.trustedContactId,
      channel: parsed.data.channel,
      destination: parsed.data.destination,
      requestId: crypto.randomUUID(),
    });
  if (!result.ok) {
    // Unknown contact and invalid destination both yield a generic 400 so a
    // caller cannot probe which contacts exist.
    return NextResponse.json(
      { error: "Could not update the destination." },
      { status: 400, headers: noStore },
    );
  }
  return NextResponse.json(
    { ok: true, destinationVerified: false },
    { headers: noStore },
  );
}
