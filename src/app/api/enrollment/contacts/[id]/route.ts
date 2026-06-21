import { NextResponse } from "next/server";
import { z } from "zod";
import { getRepositories } from "@/lib/repository/factory";
import { toContactView } from "@/lib/enrollment/contact-view";
import type { DeleteContactResponse, EnrollmentContactView } from "@/types/api";

type Context = { params: Promise<{ id: string }> };

const noStore = { "Cache-Control": "no-store" } as const;

const uuid = z.string().uuid();

// Read one owned contact (CC-201). The household is taken from the query and
// enforced at the boundary; a cross-household or unknown id is an indistinct
// 404 so a caller cannot probe another household's contacts.
export async function GET(request: Request, context: Context) {
  const { id } = await context.params;
  const householdId = new URL(request.url).searchParams.get("householdId");
  if (!householdId || !uuid.safeParse(householdId).success) {
    return NextResponse.json(
      { error: "A valid householdId is required." },
      { status: 400, headers: noStore },
    );
  }
  const contact = await getRepositories().trustedContacts.getInternalById(id);
  if (!contact || contact.householdId !== householdId) {
    return NextResponse.json(
      { error: "Contact not found." },
      { status: 404, headers: noStore },
    );
  }
  const body: EnrollmentContactView = toContactView(contact);
  return NextResponse.json(body, { headers: noStore });
}

// Delete an owned contact (CC-201). Ownership-scoped at the repository; a
// cross-household or unknown id returns a generic 404.
export async function DELETE(request: Request, context: Context) {
  const { id } = await context.params;
  const householdId = new URL(request.url).searchParams.get("householdId");
  if (!householdId || !uuid.safeParse(householdId).success) {
    return NextResponse.json(
      { error: "A valid householdId is required." },
      { status: 400, headers: noStore },
    );
  }
  const removed = await getRepositories().trustedContacts.remove(
    householdId,
    id,
  );
  if (!removed) {
    return NextResponse.json(
      { error: "Contact not found." },
      { status: 404, headers: noStore },
    );
  }
  const body: DeleteContactResponse = { ok: true };
  return NextResponse.json(body, { headers: noStore });
}
