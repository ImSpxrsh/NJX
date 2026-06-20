import "server-only";
import { recordAuditEvent } from "@/lib/observability/audit";
import { parseTwilioParams } from "./twilio-request";
import { validateTwilioSignature } from "./twilio-signature";
import { reconstructTwilioUrl } from "./twilio-url";

/**
 * Result of verifying an inbound Twilio webhook. Failures are coarse and carry no
 * secret. `NOT_CONFIGURED` means the boundary could not be enforced (no auth
 * token outside an explicit local exception) and the request must be rejected —
 * it fails closed, never open.
 */
export type TwilioVerification =
  | { ok: true; params: Record<string, string> }
  | {
      ok: false;
      code: "MISSING_SIGNATURE" | "INVALID_SIGNATURE" | "NOT_CONFIGURED";
    };

function isProduction(): boolean {
  return process.env.NODE_ENV === "production";
}

/**
 * Unsigned requests are tolerated only as an explicit local convenience: never in
 * production, and only when `TWILIO_ALLOW_UNSIGNED=true` is set deliberately.
 */
function unsignedRequestsAllowed(): boolean {
  if (isProduction()) return false;
  return process.env.TWILIO_ALLOW_UNSIGNED === "true";
}

/**
 * Verify an inbound Twilio webhook and return its parsed params on success.
 *
 * Invariant 11 (CLAUDE.md): signatures are validated whenever the auth token is
 * configured. This goes further and fails closed when the token is absent in
 * production, so a misconfigured deployment cannot silently accept unsigned
 * traffic. The body is parsed exactly once and the params are returned so callers
 * never re-read the (already consumed) request body.
 */
export async function verifyTwilioRequest(
  request: Request,
): Promise<TwilioVerification> {
  const params = await parseTwilioParams(request);
  const authToken = process.env.TWILIO_AUTH_TOKEN?.trim();
  const route = new URL(request.url).pathname;

  if (authToken) {
    const signature = request.headers.get("x-twilio-signature");
    if (!signature) {
      audit("MISSING_SIGNATURE", route);
      return { ok: false, code: "MISSING_SIGNATURE" };
    }
    const url = reconstructTwilioUrl(request);
    if (!validateTwilioSignature({ authToken, signature, url, params })) {
      audit("INVALID_SIGNATURE", route);
      return { ok: false, code: "INVALID_SIGNATURE" };
    }
    return { ok: true, params };
  }

  // No auth token configured.
  if (unsignedRequestsAllowed()) {
    return { ok: true, params };
  }
  audit("NOT_CONFIGURED", route);
  return { ok: false, code: "NOT_CONFIGURED" };
}

type TwilioFailureCode =
  | "MISSING_SIGNATURE"
  | "INVALID_SIGNATURE"
  | "NOT_CONFIGURED";

function audit(code: TwilioFailureCode, route: string): void {
  recordAuditEvent({
    event: "twilio.webhook.verify",
    outcome: "failure",
    code,
    // Route name only — never the signature, token, URL, or params.
    requestId: route,
  });
}
