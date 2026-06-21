// Centralized security-sensitive user-facing copy.
// All check-state and instruction copy must come from here.
// Never claim a message is safe, legitimate, or definitely a scam.
// Never claim verification = identity proof.

export const copy = {
  states: {
    PAUSED: "Checking your request",
    PENDING: "Waiting for verification",
    VERIFIED: "Your trusted contact responded — the source was recognized",
    DENIED: "Your trusted contact responded — the source was not recognized",
    EXPIRED: "Verification link expired",
    RECEIVED: "Request received",
  },

  statusSource: {
    POLICY_ENGINE: "Risk assessment",
    ENROLLED_CONTACT: "Trusted contact response",
    NO_RESPONSE: "Awaiting response",
    SYSTEM_EXPIRY: "Verification period ended",
  },

  actions: {
    NONE: "No further action required at this time.",
    KNOWN_NUMBER_CALLBACK:
      "If unsure, call back using a number you already know — not one from this message.",
    TRUSTED_CONTACT_CONFIRMATION:
      "Stop. Contact your trusted person through a separate channel before acting.",
    MANDATORY_HOLD_AND_VERIFY:
      "Do not act on this request. Contact your trusted person through a number you already know.",
  },

  failures: {
    checkUnavailable:
      "We could not check this request. Do not act on it yet. Use a phone number you already know.",
    supabaseUnavailable:
      "Our service is temporarily unavailable. Do not act on the request. Follow your printed safety card.",
    deliveryFailed:
      "We could not reach your trusted contact automatically. Call them using a number you already know.",
    pollingFailed:
      "We could not retrieve the latest status. Do not act on any pending request until you can verify.",
    expired:
      "This verification link has expired. Do not act on the original request without re-verifying.",
    unknown:
      "This link is not recognized. Do not act on any related request without independently verifying.",
    modelUnavailable:
      "The message could not be analyzed fully. A cautious risk level has been applied. Do not act until you verify through a number you already know.",
  },

  labels: {
    checkId: "Reference number",
    riskLevel: "Risk level",
    expiresAt: "Verification window closes",
    statusSource: "Status determined by",
    trustedContactStatus: "Trusted contact response",
  },

  // Forbidden phrases — used in tests to detect unsafe copy
  forbidden: [
    "this message is safe",
    "this is legitimate",
    "no need to worry",
    "definitely a scam",
    "100% verified",
    "guaranteed",
    "fraud detected",
    "identity confirmed",
    "this is your",
  ],
} as const;
