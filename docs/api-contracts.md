# API contracts

All JSON endpoints reject unknown fields and return no token hashes, raw
messages, contact destinations, or service credentials.

## `POST /api/analyze`

Input: `{ householdId: uuid, message: string, mode?: "fixture"|"llm" }`.
Returns the check ID, PAUSED/PENDING state, validated extraction, deterministic
decision, and optional request metadata. In demo mode only, it also returns a
clearly labeled contact URL to simulate delivery.

## `GET /api/checks/:id`

Returns state, level, summary, requested action, reasons, response status,
expiry, status source, and signals. Unknown IDs receive a generic 404.

## `GET /api/verification/context?token=...`

Returns sanitized context and PENDING/COMPLETED/EXPIRED link state.

## `POST /api/verification/respond`

Input:
`{ token, response: "CONFIRMED_MINE"|"DENIED_MINE"|"CALL_ME" }`.
Confirmation maps PENDING to VERIFIED, denial to DENIED, and callback keeps the
check PENDING. Every response consumes the link once.

## `POST /api/twilio/voice`

Verifies the Twilio signature (see below) and returns TwiML containing a
one-digit Gather. It configures no recording or transcription.

## `POST /api/twilio/gather`

Digit 1 creates an idempotent phone-originated pending verification. Other
digits create no approval. CallSid is represented only by a SHA-256 hash.

### Twilio signature verification (CC-206)

Both Twilio routes verify the request before any processing. The signature is
checked against the reconstructed public URL (pinned via `TWILIO_PUBLIC_BASE_URL`
or `PUBLIC_APP_URL`, else forwarded headers). Missing, invalid, and
not-configured cases all return a generic `403 Forbidden` with no side effects.
Unsigned requests are permitted only with an explicit non-production
`TWILIO_ALLOW_UNSIGNED=true`; production with no auth token fails closed. See
`docs/twilio-security.md`.

## Enrollment destination verification (CC-202)

These endpoints are separate from request verification and never accept or return
request-verification tokens. All responses are `no-store`.

### `POST /api/enrollment/contacts`

Input: `{ householdId: uuid, displayName, channel: "sms"|"email", destination }`.
Creates a trusted contact with an **unverified** destination (E.164 / email
normalized). Returns `{ contactId, channel, destinationVerified: false }`.

### `PUT /api/enrollment/contacts`

Input: `{ trustedContactId: uuid, channel, destination }`. Replaces the
destination, clears prior verification, and invalidates any pending secret.
Unknown contacts and invalid destinations share a generic 400.

### `POST /api/enrollment/verify/start`

Input: `{ householdId: uuid, trustedContactId: uuid }`. Issues a one-time secret
for the contact's stored destination. Returns `{ verificationId, channel,
expiresAt, demoMode }`. The raw secret is included only when enrollment demo mode
is explicitly enabled. Rate-limited (429). Unknown contact and invalid
destination share a generic 400.

### `POST /api/enrollment/verify/confirm`

Input: `{ token }` (email link) **or** `{ trustedContactId: uuid, code }` (SMS).
Returns `{ ok: true }` on success. Every failure is an indistinguishable generic
409 (`{ ok: false }`); throttling is 429. The response never reveals whether a
token existed, expired, was used, or is locked.

### `GET /api/enrollment/status?trustedContactId=...`

Returns `{ trustedContactId, channel, status, destinationVerified, expiresAt }`.
Never includes the destination value or any secret. Unknown ids receive a 404.

## `POST /api/demo/reset`

Clears process-local demo state. This route must be disabled or authenticated
before a public production deployment.
