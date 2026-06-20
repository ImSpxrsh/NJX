import { resolveHouseholdContext } from "@/lib/auth/household-context";
import { jsonOk, runRoute } from "@/lib/contacts/http";
import { assertHighTrustEligible } from "@/lib/contacts/service";

type Context = { params: Promise<{ id: string }> };

// POST /api/contacts/:id/high-trust -> high-trust gate.
// Rejects (403) unless the destination is already verified. This is the
// enforcement point for "unverified destinations never receive a high-trust
// verification request".
export async function POST(_request: Request, context: Context) {
  return runRoute(async () => {
    const { householdId } = resolveHouseholdContext();
    const { id } = await context.params;
    const contact = await assertHighTrustEligible(householdId, id);
    return jsonOk({ eligible: true, contact });
  });
}
