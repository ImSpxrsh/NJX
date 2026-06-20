import { resolveHouseholdContext } from "@/lib/auth/household-context";
import { jsonOk, parseBody, runRoute } from "@/lib/contacts/http";
import { updateContactSchema } from "@/lib/contacts/normalization";
import {
  getContact,
  removeContact,
  updateContact,
} from "@/lib/contacts/service";

type Context = { params: Promise<{ id: string }> };

// GET /api/contacts/:id -> read one owned destination.
export async function GET(_request: Request, context: Context) {
  return runRoute(async () => {
    const { householdId } = resolveHouseholdContext();
    const { id } = await context.params;
    return jsonOk(await getContact(householdId, id));
  });
}

// PATCH /api/contacts/:id -> update a destination. Always clears verification.
export async function PATCH(request: Request, context: Context) {
  return runRoute(async () => {
    const { householdId } = resolveHouseholdContext();
    const { id } = await context.params;
    const input = await parseBody(request, updateContactSchema);
    return jsonOk(await updateContact(householdId, id, input));
  });
}

// DELETE /api/contacts/:id -> remove an owned destination.
export async function DELETE(_request: Request, context: Context) {
  return runRoute(async () => {
    const { householdId } = resolveHouseholdContext();
    const { id } = await context.params;
    await removeContact(householdId, id);
    return jsonOk({ deleted: true });
  });
}
