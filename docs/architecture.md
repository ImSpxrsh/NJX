# Architecture

The runnable demo uses an in-memory, server-only repository. The production
boundary is the Supabase schema and atomic token function in `supabase/`.

```mermaid
flowchart LR
  U[Senior web form] --> A[POST /api/analyze]
  A --> E[Validated evidence extractor]
  E --> P[Deterministic policy]
  P --> C[Create sanitized check]
  C -->|L2/L3| V[Hashed one-time request]
  V --> T[Pre-enrolled contact]
  T --> R[Atomic response endpoint]
  R --> S[VERIFIED / DENIED / pending callback]
  S --> Q[Senior short polling]
  L[Landline call] --> W[Signed Twilio webhook]
  W --> G[Press 1 Gather]
  G --> C
```

Evidence extraction cannot select a level or state. Policy cannot consume
tokens. Only server repositories may transition a PENDING check to a terminal
state. The service-role client imports `server-only`.

The demo link appears in the browser only as an explicitly labeled hackathon
delivery channel. Production must deliver it directly to the enrolled
destination.

## Repository mode

All API handlers depend on the interfaces in
`src/lib/repository/contracts.ts`. They do not import the process-local store or
Supabase directly.

`CIRCLECHECK_REPOSITORY_MODE` must be set explicitly:

- `demo` selects the process-local implementation. It is non-durable and meant
  only for local demonstrations and automated tests.
- `supabase` selects the production implementation. If that implementation or
  its required configuration is unavailable, startup/request handling fails
  closed. Production never silently falls back to process-local memory.

Repository reads are divided into public-safe and privileged methods. Public
check reads omit household identifiers, evidence storage internals, contact
destinations, verification token hashes, and raw evidence spans. Demo mode also
rejects requests for household IDs other than its explicitly configured demo
household.

The Supabase check repository always inserts a check as `PAUSED`. Low-concern
checks remain paused. L2/L3 checks can become `PENDING` only through an injected
transactional verification creator. If that operation is unavailable or fails,
the repository throws and the persisted check remains `PAUSED`; it never returns
a partially created PENDING check.

The prototype does not yet have production household authentication. Until that
is implemented, Supabase public check reads fail closed unless trusted server
code supplies a household scope. Missing, unknown, and mismatched scopes all
produce the same not-found result and return no household or contact metadata.
