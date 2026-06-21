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

## Enrollment contact management (CC-201 / CC-404)

Read/list/delete and the per-household destination cap and high-trust gate.
Responses never include the raw destination value. The household is scoped at the
repository boundary; a cross-household id is indistinguishable from a missing one.

### `GET /api/enrollment/contacts?householdId=...`

Lists the household's contacts as
`{ contacts: [{ contactId, displayName, channel, destinationVerified, createdAt }] }`.

### `GET /api/enrollment/contacts/:id?householdId=...`

Returns one contact in the same public-safe shape. Cross-household or unknown ids
receive a generic 404.

### `DELETE /api/enrollment/contacts/:id?householdId=...`

Removes an owned contact (and any pending enrollment secret). Returns
`{ ok: true }`; cross-household or unknown ids receive a generic 404.

### `POST /api/enrollment/contacts/:id/high-trust`

Input: `{ householdId: uuid }`. Returns `{ eligible: true, contact }` only when
the destination is already verified; otherwise 403. Enforces that unverified
destinations never receive a high-trust verification request.

### Destination cap

`POST /api/enrollment/contacts` rejects creation with 429 once a household
reaches `MAX_DESTINATIONS_PER_HOUSEHOLD` (default 10).

## `POST /api/demo/reset`

Clears process-local demo state. This route must be disabled or authenticated
before a public production deployment.
