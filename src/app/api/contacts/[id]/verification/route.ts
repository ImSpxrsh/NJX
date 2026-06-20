import { resolveHouseholdContext } from "@/lib/auth/household-context";
import { jsonOk, parseBody, runRoute } from "@/lib/contacts/http";
import { startVerificationSchema } from "@/lib/contacts/normalization";
import { startDestinationVerification } from "@/lib/contacts/service";

type Context = { params: Promise<{ id: string }> };

// POST /api/contacts/:id/verification -> start destination verification.
// Separate workflow from enrollment; issues a hashed one-time code.
export async function POST(request: Request, context: Context) {
  return runRoute(async () => {
    const { householdId } = resolveHouseholdContext();
    const { id } = await context.params;
    const { channel } = await parseBody(request, startVerificationSchema);
    const result = await startDestinationVerification(householdId, id, channel);
    return jsonOk(result, 202);
  });
}
