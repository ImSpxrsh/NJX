# Security review — CC-206 Twilio signature validation

Internal engineering review of the Twilio webhook signature boundary. Not an
external audit.

## Scope and method

Reviewed trust boundaries, signature verification logic, proxy URL
reconstruction, environment configuration, replay assumptions, logging, and
failure behavior against `CLAUDE.md` (invariant 11) and the threat model.
Verified by typecheck, lint, a production build, and 31 dedicated Twilio tests
(136 total) including fixtures with real Twilio-computed signatures.

## Findings

| #   | Severity | Finding                                                                                                                                                                                                        |
| --- | -------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | High     | `validateTwilioRequest` returned `true` when no auth token was set — a production deploy missing the token accepted all unsigned webhooks (fail-open), inconsistent with the cron route's fail-closed pattern. |
| 2   | High     | Handlers validated against `request.url` with no proxy URL reconstruction; behind Vercel/a reverse proxy, valid Twilio signatures fail (or pass only by luck) because Twilio signs the public URL.             |
| 3   | Medium   | The unsigned-request exception was implicit (token-absence) rather than an explicit, production-disabled flag.                                                                                                 |
| 4   | High     | No test coverage existed for the signature boundary, so none of the above was observable.                                                                                                                      |

## Fixes applied

- **Fail closed (F1, F3):** signature math moved to a pure `validateTwilioSignature`
  that never fails open. A new `verifyTwilioRequest` orchestrator rejects with
  `NOT_CONFIGURED` when no token is set, except for an explicit, non-production
  `TWILIO_ALLOW_UNSIGNED=true`. Production never accepts unsigned traffic.
- **URL reconstruction (F2):** `reconstructTwilioUrl` rebuilds the signed public
  URL from a pinned base (`TWILIO_PUBLIC_BASE_URL`/`PUBLIC_APP_URL`) or forwarded
  headers, always taking path+query from the request. Spoofed forwarded headers
  cannot yield a matching signature.
- **Generic failures:** routes return a single `403 Forbidden` for every failure
  code; only a coarse category is logged (no token/signature/URL/params).
- **Tests (F4):** 31 tests covering URL reconstruction (Vercel/proxy/forwarded/
  base-pinning), missing/invalid/valid signatures, production fail-closed,
  test/demo isolation, form-encoded + query-param signing, header spoofing, body/
  URL/signature tampering, content-type abuse, redacted logging, and downstream
  no-side-effects on failure.

## Trust boundary

The signature is the sole caller authentication for the phone flow. With the
fixes, validation is exact (correct public URL + params), fails closed, and
performs no side effects on failure — so a forged or tampered request cannot
create a phone alert or check.

## Replay resistance

Twilio signatures are not nonce-based; an attacker who captures a full valid
request (signature + body + the exact URL) could in principle replay it. This is
inherent to Twilio's scheme and out of scope for signature validation. It is
mitigated downstream: the gather handler is idempotent per `CallSid` (a replay of
the same call creates no second alert), and pressing 1 only ever raises friction
(creates an L3 hold), never an approval. HTTPS prevents network capture in
transit.

## Remaining risks / follow-ups

- Without `TWILIO_PUBLIC_BASE_URL`, reconstruction trusts forwarded headers; safe
  for validation but pinning the base URL is recommended in production.
- Runtime fail-closed should be backstopped by CC-703 environment validation
  refusing production startup without `TWILIO_AUTH_TOKEN`.
- True replay/nonce protection (e.g. timestamp + seen-signature cache) is a
  possible future hardening beyond Twilio's native scheme.
- CC-205 will replace the demo household mapping in the gather handler; it does
  not affect this boundary.
