# Twilio webhook security (CC-206)

The Twilio webhooks (`POST /api/twilio/voice`, `POST /api/twilio/gather`) are an
unauthenticated public surface whose only caller authentication is the Twilio
request signature. This document records how that boundary is enforced and why it
is trusted.

## Why the signature is the trust boundary

Twilio signs each webhook with HMAC-SHA1 over the exact public URL it was
configured to call, plus the POST parameters, keyed by the account's auth token.
Only a party holding the auth token (Twilio, and our server) can produce a valid
signature. A correct signature therefore proves the request came from Twilio and
was not tampered with. Everything downstream (creating a phone-originated L3
check) depends on this proof, so the validation must be exact and must fail
closed.

## Verification flow

`verifyTwilioRequest(request)` ([twilio-webhook.ts](../src/lib/security/twilio-webhook.ts)):

1. Parse params once via `parseTwilioParams` and return them on success so the
   route never re-reads the consumed body.
2. If `TWILIO_AUTH_TOKEN` is set:
   - reject a missing signature (`MISSING_SIGNATURE`);
   - reconstruct the public URL (below) and verify with the pure
     `validateTwilioSignature` (`twilio.validateRequest`); reject on mismatch
     (`INVALID_SIGNATURE`).
3. If no token is set:
   - allow only when not in production **and** `TWILIO_ALLOW_UNSIGNED=true`
     (explicit local convenience);
   - otherwise reject (`NOT_CONFIGURED`) — fail closed.

Routes translate every failure to a single generic `403 Forbidden`.

## URL reconstruction behind a proxy

Twilio signs the public URL, but behind Vercel/a reverse proxy the handler may
see an internal host/scheme. `reconstructTwilioUrl`
([twilio-url.ts](../src/lib/security/twilio-url.ts)) rebuilds the signed URL,
most trustworthy source first:

1. `TWILIO_PUBLIC_BASE_URL` (else `PUBLIC_APP_URL`) — pins scheme + host and is
   immune to forwarded-header spoofing. **Recommended for production.**
2. `x-forwarded-proto` / `x-forwarded-host` (first hop), falling back to `host`.
3. The raw `request.url`.

The path and query always come from the request, never a header. Forging
host/scheme cannot make validation pass: the attacker still cannot produce a
matching signature without the auth token.

## Local and test exceptions

Unsigned requests are accepted only with an explicit, non-production
`TWILIO_ALLOW_UNSIGNED=true`. Token-absence alone never permits unsigned traffic,
and production (`NODE_ENV=production`) never permits it. This isolates the
development convenience from the production boundary.

## Failure behavior

A verification failure stops processing before any side effect: no phone alert is
registered, no check is created, no state changes. The caller receives a generic 403. This preserves the printed-card instruction to stop and call a known number.

## Logging

Only a coarse failure category is recorded (`twilio.webhook.verify` with a code
of `MISSING_SIGNATURE` / `INVALID_SIGNATURE` / `NOT_CONFIGURED`). The auth token,
signature, reconstructed URL, and request params are never logged.

## Configuration

| Variable                 | Purpose                                                       |
| ------------------------ | ------------------------------------------------------------- |
| `TWILIO_AUTH_TOKEN`      | Enables signature validation. Required in production.         |
| `TWILIO_PUBLIC_BASE_URL` | Pins the public scheme+host for URL reconstruction.           |
| `TWILIO_ALLOW_UNSIGNED`  | Non-production only; permits unsigned requests for local dev. |

## Follow-up

- CC-703 environment validation should refuse production startup when
  `TWILIO_AUTH_TOKEN` is missing, making the runtime fail-closed redundant.
- CC-205 will replace the demo household mapping in the gather handler; it does
  not change this signature boundary.
