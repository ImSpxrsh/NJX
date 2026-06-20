# Enrollment destination verification (CC-202)

Destination verification proves, during calm-time enrollment, that a trusted
contact's phone or email is reachable and controlled before that destination can
receive a high-trust verification request. It is a **separate subsystem** from
request verification and shares no infrastructure with it.

## Separation from request verification

| Concern        | Request verification (CC-104/105) | Enrollment verification (CC-202)       |
| -------------- | --------------------------------- | -------------------------------------- |
| Purpose        | Confirm a specific check          | Confirm a destination is reachable     |
| Table          | `verification_requests`           | `enrollment_verifications`             |
| Token hashing  | `sha256(token)`                   | `sha256("…:v1:link:"/"…:v1:code:"…)`   |
| Repository     | `verificationRequests`            | `enrollmentVerifications`              |
| API surface    | `/api/verification/*`             | `/api/enrollment/*`                    |
| Audit events   | n/a                               | `enrollment.*`                         |
| Terminal state | `VERIFIED` / `DENIED` on a check  | `destination_verified_at` on a contact |

Because the hash input is purpose-bound, a request-verification token can never
satisfy an enrollment lookup and an enrollment secret can never satisfy a
request-verification response — even if the raw values were identical. This is
asserted by tests in `enrollment-demo-store.test.ts`.

## Token lifecycle

1. **Issue** (`start`). The contact's _stored_ destination determines the
   channel. SMS issues an 8-digit CSPRNG code bound to the contact id; email
   issues a 256-bit CSPRNG link token. Only the purpose-bound hash is stored; the
   raw secret is returned once to the trusted server caller (the notification
   service in CC-203, or a demo response) and never persisted or logged. A new
   issue supersedes any prior `PENDING` secret (DB enforces one pending row per
   contact).
2. **Deliver.** Out of scope for CC-202; CC-203 delivers the secret. In demo mode
   the secret is surfaced in the API response, clearly labeled.
3. **Confirm** (`confirmByToken` / `confirmByCode`). The supplied secret is
   hashed inside the trusted boundary and compared in constant time. Success is
   single-use and atomically marks the contact's destination verified. Codes
   track an attempt count and lock at `ENROLLMENT_MAX_ATTEMPTS`.
4. **Expire / lock / supersede.** Expired, used, locked, and superseded secrets
   all fail. Failures collapse to a single generic result so an attacker cannot
   distinguish them (no enumeration of validity or enrollment state).
5. **Change.** Changing a destination clears `destination_verified_at` and
   invalidates any pending secret, forcing re-verification.

## Demo mode

`ENROLLMENT_DEMO_MODE=on` is honored only when
`CIRCLECHECK_REPOSITORY_MODE=demo`. It is the only path that returns a secret to
a client, and it is always labeled. Production runs `supabase` mode, so demo mode
cannot be activated there and cannot weaken production security.

## Persisted data (`enrollment_verifications`)

| Field                               | Purpose                     | Readable by  | Identifies a person?                 | Sent to a model |
| ----------------------------------- | --------------------------- | ------------ | ------------------------------------ | --------------- |
| `destination`                       | Value under verification    | service role | Yes — excluded from all public reads | No              |
| `secret_hash`                       | One-time secret (hash only) | service role | No                                   | No              |
| `attempt_count` / `last_attempt_at` | Brute-force defense         | service role | No                                   | No              |
| `status` / `expires_at`             | Lifecycle                   | service role | No                                   | No              |

The raw code/link is never stored. Public status reads
(`EnrollmentVerificationStatusView`) expose only the contact id, channel,
lifecycle status, a boolean `destinationVerified`, and expiry.

## Rate limiting

`start` is limited per household and per contact; `confirm` is limited per coarse
network hint (hashed, never stored raw). Rate-limit responses are generic 429s
that reveal nothing about validity or enrollment state. The in-process limiter is
adequate for the demo and single-instance pilots; multi-instance deployments
require a shared store (CC-503).

## Failure behavior

Any verification, infrastructure, or database failure leaves the destination
**unverified**. A destination is marked verified only by a successful, single-use
secret consumption inside the trusted server boundary.

## Follow-up dependencies

- **CC-203** delivers the secret over SMS/email and is the production delivery
  path (demo mode is the stand-in here).
- A Supabase `EnrollmentVerificationRepository` (mirroring the demo store and the
  `consume_enrollment_*` functions in migration `002`) lands with the broader
  Supabase repository work; issuance wiring is included there.
- Full enrollment endpoints/UI and per-household spam controls are CC-201/CC-404.
