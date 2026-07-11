# Backup, Recovery, and Incident Runbook (CC-509)

## Provider Outage

**Who acts:** Backend engineer, captain notified.

**Steps:**
1. Check Supabase status page and Twilio status page.
2. If Supabase is down: the analyze endpoint falls back to demo repository if `CIRCLECHECK_RUNTIME_MODE=demo`; otherwise returns 503. Do not serve stale check data.
3. If Twilio is down: notification sends will fail. The check remains PENDING — this is correct behavior. Users see "contact delivery failed" UI.
4. Communicate status to affected users via the limitations notice.
5. Resume: verify first check end-to-end before removing any incident notice.

## Leaked Service-Role Key

**Who acts:** Captain immediately; backend engineer assists.

1. **Revoke** the key in Supabase dashboard → Project Settings → API.
2. **Generate** a new key and update `SUPABASE_SERVICE_ROLE_KEY` in Vercel environment variables.
3. **Redeploy** the application to pick up the new key.
4. **Audit** Supabase logs for any access in the 24 hours before discovery.
5. **Document** what data was potentially accessible and whether any was exported.
6. If personal data was accessed: follow applicable breach notification requirements.

## Leaked Twilio Auth Token

**Who acts:** Backend engineer immediately.

1. Rotate the Twilio auth token in the Twilio console.
2. Update `TWILIO_AUTH_TOKEN` in Vercel environment variables.
3. Redeploy immediately.
4. Review Twilio call/message logs for unauthorized sends in the past 24 hours.
5. If unauthorized calls were made to contacts: notify affected users.

## Verification-Link Leakage

**Scenario:** Verification token URLs appear in logs, analytics, or error messages.

1. Immediately disable the logging sink or analytics integration that captured the URLs.
2. Identify which tokens were exposed and mark them consumed/invalidated in the database.
3. Notify the contacts whose verification links were exposed — they should not use the links.
4. Review `src/lib/security/redact.ts` to ensure the token-bearing path pattern is in the redact list.
5. Add a regression test confirming the URL does not appear in logs.

## Notification Spam

**Scenario:** A contact receives many repeated verification alerts.

1. Identify the household/check generating the spam.
2. Temporarily block notifications for that household in the database.
3. Investigate whether the spam is from a loop in the check submission flow or a malicious actor.
4. If malicious: apply a rate limit override for the source IP and notify the user.
5. Rate limit configuration: `src/lib/security/rate-limit.ts`.

## Database Corruption

1. Stop accepting new check submissions (set `CIRCLECHECK_MAINTENANCE=true` if available, otherwise take down).
2. Identify the scope: which tables and time range are affected.
3. Restore from the most recent Supabase point-in-time backup before the corruption.
4. Validate by checking a known-good check's status.
5. Resume. Document what was lost.

**Backup policy:** Supabase Pro plan includes daily backups with 7-day retention. Verify this is enabled in the project settings.

## Accidental Raw-Message Logging

**Scenario:** A stack trace, debug log, or analytics event captures the message text from a check.

1. Immediately purge the affected log entries from the logging provider.
2. If the logs were exported or accessible to third parties: assess data exposure.
3. Identify the code path that leaked the message.
4. Fix the code path and add a test to `src/lib/security/redact.test.ts` covering the pattern.
5. Review all log calls in the analyze route for similar issues.

## Compromised Demo Deployment

**Scenario:** The demo deployment is used maliciously (e.g., to harvest contact responses).

1. Set `CIRCLECHECK_RUNTIME_MODE` to a non-demo value to disable demo features.
2. Revoke the demo deployment's environment variables.
3. Review the demo contact URL list for any non-test entries.
4. The demo repository is in-memory and does not persist data — no persistent data to clean up.

## Rollback to Deterministic-Only Extraction

**Scenario:** The LLM extractor is producing incorrect results or is unavailable.

1. Unset `EVIDENCE_ANTHROPIC_API_KEY` in Vercel environment variables.
2. Redeploy.
3. The `LlmEvidenceExtractor` will fall back to `FixtureEvidenceExtractor` (deterministic-only) on every request because no provider is configured.
4. Policy levels will be the same as or more conservative than with LLM enabled.
5. Monitor: check that `fallbackUsed: true` appears in structured logs for all requests.
6. Re-enable the LLM provider only after the root cause is identified and fixed.
