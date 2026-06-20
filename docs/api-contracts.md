# API contracts

All JSON endpoints reject unknown fields and return no token hashes, raw
messages, contact destinations, or service credentials.

## `POST /api/analyze`

Input: `{ householdId: uuid, message: string, mode?: "fixture"|"llm" }`.

**Production response** — strict schema, no demo-only fields:
```json
{
  "checkId": "<uuid>",
  "state": "PAUSED | PENDING",
  "extraction": { ... },
  "decision": { ... },
  "verification": {
    "requestId": "<uuid>",
    "expiresAt": "<iso8601>"
  }
}
```
`verification` is omitted when no contact confirmation is required.
The production schema never includes `demoContactUrl`, raw tokens, token
hashes, or verification URLs. The strict Zod schema will throw rather than
silently include forbidden fields.

**Demo response** — only returned when `CIRCLECHECK_REPOSITORY_MODE=demo`
and `NODE_ENV` is not `production`:
```json
{
  "checkId": "<uuid>",
  "state": "PENDING",
  "extraction": { ... },
  "decision": { ... },
  "verification": { "requestId": "<uuid>", "expiresAt": "<iso8601>" },
  "demoContactUrl": "http://localhost:3000/verify/<token>"
}
```
`demoContactUrl` is present only when verification is required.
Client-supplied data (query params, headers, body fields, cookies) cannot
activate demo mode or cause `demoContactUrl` to appear.
Returns the check ID, PAUSED/PENDING state, validated extraction, deterministic
decision, and optional non-secret request metadata.

Production uses a strict response schema that has no demo URL or raw-token
field. Explicit demo runtime uses a separate strict schema and may include
`verification.demoContactUrl` to simulate delivery.

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

Digit 1 from a preconfigured caller route creates an idempotent phone-originated
pending verification. Unknown callers receive the same printed-card safety
instruction with no household disclosure. Other digits create no approval.
CallSid is represented only by a SHA-256 hash. Known caller alerts deliver the
same one-time trusted-contact verification link used by web checks. Delivery
failure does not change the TwiML safety instruction or lower friction.

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

Clears process-local demo state.

**Unavailable outside demo mode.** Returns `404 Not Found` when
`CIRCLECHECK_REPOSITORY_MODE` is not `demo`, or when `NODE_ENV=production`
regardless of repository mode. The 404 check occurs before any database
access; no state is read or mutated on non-demo requests.

In demo mode, resets only the in-memory demo store. The response body is
`{ "ok": true }` with no tokens, verification URLs, or household identifiers.
Clears process-local demo state only in explicit demo runtime after a
same-origin check. It returns 404 before repository access in production,
development, and test runtime by default.
