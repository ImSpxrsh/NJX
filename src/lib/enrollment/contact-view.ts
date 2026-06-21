import type { EnrollmentContactView } from "@/types/api";
import type { TrustedContactRecord } from "@/types/domain";

/**
 * Public-safe projection of a trusted contact. Deliberately omits the raw
 * destination value (phone/email) and household id so management responses obey
 * the API-wide rule that contact destinations are never returned.
 */
export function toContactView(
  contact: TrustedContactRecord,
): EnrollmentContactView {
  return {
    contactId: contact.id,
    displayName: contact.displayName,
    channel: contact.channel,
    destinationVerified: contact.destinationVerifiedAt !== null,
    createdAt: contact.createdAt,
  };
}
