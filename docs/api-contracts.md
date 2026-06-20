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

Digit 1 from a preconfigured caller route creates an idempotent phone-originated
pending verification. Unknown callers receive the same printed-card safety
instruction with no household disclosure. Other digits create no approval.
CallSid is represented only by a SHA-256 hash. Known caller alerts deliver the
same one-time trusted-contact verification link used by web checks. Delivery
failure does not change the TwiML safety instruction or lower friction.

## `POST /api/demo/reset`

Clears process-local demo state. This route must be disabled or authenticated
before a public production deployment.
