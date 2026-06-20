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

Clears process-local demo state.

**Unavailable outside demo mode.** Returns `404 Not Found` when
`CIRCLECHECK_REPOSITORY_MODE` is not `demo`, or when `NODE_ENV=production`
regardless of repository mode. The 404 check occurs before any database
access; no state is read or mutated on non-demo requests.

In demo mode, resets only the in-memory demo store. The response body is
`{ "ok": true }` with no tokens, verification URLs, or household identifiers.
