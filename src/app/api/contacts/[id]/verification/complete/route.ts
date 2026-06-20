import { resolveHouseholdContext } from "@/lib/auth/household-context";
import { jsonOk, parseBody, runRoute } from "@/lib/contacts/http";
import { completeVerificationSchema } from "@/lib/contacts/normalization";
import { completeDestinationVerification } from "@/lib/contacts/service";

type Context = { params: Promise<{ id: string }> };

// POST /api/contacts/:id/verification/complete -> submit the one-time code.
// On success this is the ONLY path that marks a destination verified.
export async function POST(request: Request, context: Context) {
  return runRoute(async () => {
    const { householdId } = resolveHouseholdContext();
    const { id } = await context.params;
    const { code } = await parseBody(request, completeVerificationSchema);
    return jsonOk(await completeDestinationVerification(householdId, id, code));
  });
}
