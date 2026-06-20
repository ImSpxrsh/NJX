# Notification architecture (CC-203)

The notification service delivers messages over pluggable providers. It is the
only component that talks to a delivery provider, and it is deliberately
ignorant of trust state: **delivery is not identity verification**.

## Layers

```
caller (e.g. enrollment send route)
  -> enrollment-notifier (builds sanitized message, picks idempotency key)
    -> NotificationService (retry, backoff, idempotency, redacted logging)
      -> NotificationProvider  (sms | email adapter)
        -> Transport           (Twilio / email API; in-memory by default)
```

Business logic depends only on `NotificationProvider` and the sanitized
`OutboundNotification` type, so a new provider is added by writing an adapter and
injecting it — no service or caller changes.

## Delivery is not identity

`DeliveryStatus` is `DELIVERED` or `FAILED`. Neither equals `CONFIRMED` or
`VERIFIED`. The service has no access to check or enrollment state, so a provider
success structurally cannot change a verification outcome. Tests assert that a
`DELIVERED` outcome carries no trust fields and that a successful delivery does
not mark a destination verified.

## Content safety

`OutboundNotification` has no field for a household id, suspicious message,
contact secret, challenge value, or verification state — only the destination and
a sanitized body. The body carries the one-time link (email) or code (SMS) and
nothing else. The email link contains only the token; it has no identifiers.

## Logging

The service logs only coarse, allowlisted fields via the typed audit emitter:
event name, outcome, request id, provider channel, coarse error category, and
attempt count. Tokens, destinations, URLs, and message bodies are never logged.
A test feeds a token-bearing message and asserts the token never appears in any
emitted event.

## Retry and idempotency

- **Bounded exponential backoff**: `base * 2^(attempt-1)`, capped at
  `NOTIFICATION_MAX_ATTEMPTS`. Only retryable failures (timeout, transport error)
  are retried; a permanent rejection stops immediately.
- **Idempotency**: `deliver` dedupes by `idempotencyKey` (the enrollment
  verification id). A duplicate job returns the first outcome and never re-sends.
- **No token creation**: the service only delivers an already-issued secret, so
  no retry can create multiple active tokens.

## Failure behavior

A delivery failure returns `manualCallbackGuidance` and changes nothing. The
destination stays unverified and any associated check stays `PENDING`. The
guidance tells the user not to act and to use a number they already know.

## Provider integration status

The repository ships with an in-memory transport (no live credentials), matching
the project's deterministic-by-default posture. A production deployment injects
Twilio (SMS) and an email transport in `enrollment-notifier.ts` without touching
the service. Wiring the request-verification delivery path is a follow-up that
lands with CC-104.
