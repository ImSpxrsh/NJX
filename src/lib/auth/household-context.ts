import "server-only";
import { ContactError } from "@/lib/contacts/errors";

// SECURITY: the acting household is established ONLY here, server-side. Route
// handlers must derive ownership from this resolver and must never read a
// household identifier from a request body or query string. Any client-supplied
// `householdId` is ignored/rejected by the route schemas (`.strict()`).
//
// Production user authentication is out of scope for this prototype (see
// docs/threat-model.md). This module is the seam where the platform's real
// session/JWT verification slots in:
//   - demo mode      -> the single configured demo household.
//   - supabase mode  -> the authenticated Supabase session (fail closed until
//                       production auth is wired).

export type HouseholdContext = { householdId: string };

const DEMO_HOUSEHOLD_FALLBACK = "00000000-0000-4000-8000-000000000001";

export function resolveHouseholdContext(): HouseholdContext {
  const mode = process.env.CIRCLECHECK_REPOSITORY_MODE;

  if (mode === "demo") {
    return {
      householdId: process.env.DEMO_HOUSEHOLD_ID ?? DEMO_HOUSEHOLD_FALLBACK,
    };
  }

  if (mode === "supabase") {
    // Production session resolution is not implemented yet. Fail closed rather
    // than trusting any client-provided identity.
    throw new ContactError(
      "FORBIDDEN",
      "Authenticated household context is unavailable.",
    );
  }

  throw new ContactError(
    "FORBIDDEN",
    "CIRCLECHECK_REPOSITORY_MODE must be set to demo or supabase.",
  );
}
