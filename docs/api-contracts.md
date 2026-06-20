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

Validates the Twilio signature when configured and returns TwiML containing a
one-digit Gather. It configures no recording or transcription.

## `POST /api/twilio/gather`

Digit 1 creates an idempotent phone-originated pending verification. Other
digits create no approval. CallSid is represented only by a SHA-256 hash.

## Trusted-contact enrollment (CC-101)

The acting household is taken from the authenticated server context only. Every
request body is `.strict()`: a client-supplied `household_id`, `verified`, `id`,
or any other unknown field is rejected (422). Responses never include the
household identifier, verification code, or code hash. Enrollment writes never
verify a destination; verification is a separate workflow and the only way to
set `verified`.

### `POST /api/contacts`

Input: `{ displayName: string, phone?: string, email?: string }` (at least one
of `phone`/`email`). Phone is normalized to E.164; email is trimmed and
lowercased; invalid values are rejected (422). Returns the created destination
with `verified: false`, `verifiedAt: null`, `verifiedChannel: null` (201).
Rejects with 429 when the per-household destination limit is reached.

### `GET /api/contacts`

Returns `{ contacts: [...] }` scoped to the authenticated household.

### `GET /api/contacts/:id`

Returns one owned destination. Another household's id returns 403; an unknown id
returns 404.

### `PATCH /api/contacts/:id`

Input: `{ displayName?, phone?: string|null, email?: string|null }`. `null`
clears a channel; at least one must remain. Any successful update clears
verification state (re-verification required).

### `DELETE /api/contacts/:id`

Removes an owned destination (cross-household → 403).

### `POST /api/contacts/:id/verification`

Input: `{ channel: "sms"|"email" }`. Starts the separate destination-verification
workflow: issues a hashed, expiring, single-use code (delivered via Twilio SMS
when configured). Returns `{ verificationId, channel, expiresAt }` (202); in demo
mode only it also returns a clearly labeled `demoCode`. Rejects with 429 when the
per-household verification-start rate limit is exceeded.

### `POST /api/contacts/:id/verification/complete`

Input: `{ code: string }`. On an exact, live, in-budget match it marks the
destination verified, recording the timestamp and channel. Expired, exhausted,
or mismatched codes never verify (400); too many attempts lock the challenge
(429).

### `POST /api/contacts/:id/high-trust`

High-trust gate. Returns `{ eligible: true, contact }` only when the destination
is already verified; otherwise 403. Unverified destinations never receive a
high-trust verification request.

## `POST /api/demo/reset`

Clears process-local demo state. This route must be disabled or authenticated
before a public production deployment.
