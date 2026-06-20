import "server-only";

/**
 * Minimal allowlist audit emitter.
 *
 * Only the coarse, non-sensitive fields modeled below may be recorded. The type
 * system is the enforcement mechanism: there is no free-form payload, so a
 * secret, token, destination, or raw message cannot be passed without a type
 * error. This is the precursor to the full structured logger (CC-504).
 *
 * Severity-free by design: callers describe *what happened* with a coarse
 * outcome, never *why* in a way that could echo a secret.
 */
export type AuditOutcome = "success" | "failure" | "rate_limited";

export type AuditEvent = {
  // Stable, coarse event name, e.g. "enrollment.verify.start".
  event: string;
  outcome: AuditOutcome;
  // Correlation only. Never a token, destination, or raw message.
  requestId?: string;
  // Coarse, non-secret identifiers permitted by policy.
  householdId?: string;
  trustedContactId?: string;
  enrollmentId?: string;
  channel?: "sms" | "email";
  // A coarse, enumerated reason code — never raw error text or input.
  code?: string;
  attemptCount?: number;
};

type AuditSink = (event: AuditEvent) => void;

const defaultSink: AuditSink = (event) => {
  // Tests and most CI runs stay quiet; structured shipping is CC-504's concern.
  if (process.env.NODE_ENV === "test") return;
  if (process.env.CIRCLECHECK_AUDIT_LOG === "off") return;
  console.info(JSON.stringify({ kind: "audit", ...event }));
};

let sink: AuditSink = defaultSink;

export function recordAuditEvent(event: AuditEvent): void {
  sink(event);
}

/** Test seam: capture emitted events without going through stdout. */
export function setAuditSinkForTests(next: AuditSink | null): void {
  sink = next ?? defaultSink;
}
