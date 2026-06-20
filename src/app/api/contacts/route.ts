import { resolveHouseholdContext } from "@/lib/auth/household-context";
import { jsonOk, parseBody, runRoute } from "@/lib/contacts/http";
import { createContactSchema } from "@/lib/contacts/normalization";
import { enrollContact, listContacts } from "@/lib/contacts/service";
import type { ContactListResponse } from "@/types/api";

// GET /api/contacts -> list the authenticated household's destinations.
export async function GET() {
  return runRoute(async () => {
    const { householdId } = resolveHouseholdContext();
    const contacts = await listContacts(householdId);
    return jsonOk<ContactListResponse>({ contacts });
  });
}

// POST /api/contacts -> create a destination for the authenticated household.
// Ownership comes only from the session; the body schema rejects householdId.
export async function POST(request: Request) {
  return runRoute(async () => {
    const { householdId } = resolveHouseholdContext();
    const input = await parseBody(request, createContactSchema);
    const contact = await enrollContact(householdId, input);
    return jsonOk(contact, 201);
  });
}
