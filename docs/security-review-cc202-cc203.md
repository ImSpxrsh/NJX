# Security review — CC-202 and CC-203

Internal engineering review of destination verification (CC-202) and the
notification service (CC-203). This is not an external audit.

## Scope and method

Reviewed trust boundaries, token lifecycle, replay resistance, rate limits,
retry logic, logging, household isolation, concurrency, and failure modes against
`CLAUDE.md`, `docs/architecture.md`, and `docs/threat-model.md`. Verified by
typecheck, lint, 111 unit/threat tests, a production build, and a secret/log
scan.

## Trust boundaries

- Destination verification is a separate subsystem from request verification:
  separate table, purpose-bound hashing, repository, API namespace, and audit
  events. Cross-use is impossible and is tested both directions.
- A destination is marked verified only by single-use secret consumption inside
  the server/DB boundary. No client value, query param, or model output can set
  it.
- The notification service has no access to check/enrollment state, so delivery
  cannot affect verification (DELIVERED ≠ CONFIRMED ≠ VERIFIED).

## Token lifecycle

- CSPRNG secrets (256-bit email links; contact-bound 8-digit SMS codes),
  purpose-bound SHA-256 at rest, single-use, short TTL, one active secret per
  contact (DB partial unique index).
- Raw secrets are never stored, never logged, and only returned to clients in
  explicit demo mode.
- Changing a destination clears verification and invalidates pending secrets.

## Replay / brute force

- Used, expired, locked, and superseded secrets all fail. Email replay and SMS
  lockout are tested.
- SMS codes have a strict per-record attempt cap; the DB function commits
  attempt increments without exception rollback.
- Confirm failures collapse to one generic result (no enumeration of validity or
  state).

## Rate limits

- `start` limited per household and per contact; `confirm` limited per hashed
  network hint. Responses are generic 429s that reveal nothing.

## Retry logic (CC-203)

- Bounded exponential backoff; only retryable categories retried; idempotent by
  verification id; never creates additional tokens.

## Logging / auditability

- Only the typed audit emitter logs; its type forbids passing a secret,
  destination, URL, or raw message. Coarse fields only. A test asserts tokens
  never appear in emitted events.

## Household isolation

- Cross-household `start` is an indistinguishable not-found; SMS codes are bound
  to a contact id; public reads omit household id and destination.

## Concurrency

- Demo store consume is a synchronous critical section (single-use holds under
  concurrent confirmation — tested). The DB mirrors this with `for update` row
  locks and the one-pending unique index.

## Failure modes

- Verification, infrastructure, and database failures leave the destination
  unverified. Delivery failure leaves the check pending and returns manual
  callback guidance to a known number.

## Findings and fixes applied

| #   | Finding                                                                          | Resolution                                                                                   |
| --- | -------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| 1   | A failed DB code attempt could roll back its own attempt increment if it raised. | `consume_enrollment_code` returns a status instead of raising, so increments commit.         |
| 2   | Reusing request-token format for enrollment links risks cross-use.               | Domain-separated (purpose-bound) hashing + separate table; cross-use tested both directions. |
| 3   | Demo secrets could leak if the flag were set in production.                      | Demo mode requires `CIRCLECHECK_REPOSITORY_MODE=demo`, impossible in production.             |
| 4   | Raw network hints could become limiter keys.                                     | `rateLimitKey` hashes all factors before use.                                                |

## Remaining risks / follow-ups

- In-process rate limiting and idempotency suit single-instance pilots only;
  multi-instance needs a shared store (CC-503) and a durable retry queue.
- The Supabase enrollment repository and live SMS/email transports are not wired
  here (demo store + in-memory transport stand in), consistent with the repo's
  current maturity.
- Destination normalization is conservative, not carrier-grade; no deliverability
  proof.
- Request-verification delivery wiring depends on CC-104.
