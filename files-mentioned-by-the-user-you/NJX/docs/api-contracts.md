# API contracts

All JSON endpoints reject unknown fields and return no token hashes, raw
messages, contact destinations, or service credentials.

## `POST /api/analyze`

Input: `{ householdId: uuid, message: string, mode?: "fixture"|"llm" }`.
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

Validates the Twilio signature when configured and returns TwiML containing a
one-digit Gather. It configures no recording or transcription.

## `POST /api/twilio/gather`

Digit 1 creates an idempotent phone-originated pending verification. Other
digits create no approval. CallSid is represented only by a SHA-256 hash.

## `POST /api/demo/reset`

Clears process-local demo state only in explicit demo runtime after a
same-origin check. It returns 404 before repository access in production,
development, and test runtime by default.
