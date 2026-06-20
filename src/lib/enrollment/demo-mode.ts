/**
 * Enrollment demo mode (CC-202).
 *
 * Demo mode is the only situation in which an enrollment secret (code or link)
 * is surfaced in an API response. It is disabled by default and can only be on
 * when BOTH conditions hold:
 *   - the repository is the explicitly non-durable demo store, and
 *   - `ENROLLMENT_DEMO_MODE` is explicitly the string "on".
 *
 * Because production runs `CIRCLECHECK_REPOSITORY_MODE=supabase`, demo mode is
 * impossible to activate in production even if the second flag were set by
 * mistake. It therefore cannot weaken production security.
 */
export function isEnrollmentDemoMode(): boolean {
  return (
    process.env.CIRCLECHECK_REPOSITORY_MODE === "demo" &&
    process.env.ENROLLMENT_DEMO_MODE === "on"
  );
}

export const ENROLLMENT_DEMO_NOTICE =
  "DEMO MODE — this secret is shown only because enrollment demo mode is " +
  "explicitly enabled. Production never returns enrollment secrets to clients.";
