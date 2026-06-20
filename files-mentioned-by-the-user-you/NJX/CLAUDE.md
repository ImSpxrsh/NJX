# CircleCheck engineering contract

CircleCheck converts suspicious-request evidence into a deterministic verification
requirement. Only a separate, pre-enrolled contact event can establish that the
contact made the request.

## Boundaries

- `lib/evidence` extracts and validates evidence only.
- `lib/policy` alone selects L0-L3.
- `lib/state` alone defines state transitions.
- `lib/security` and server repositories own tokens and secrets.
- Browser code cannot mutate terminal check states.
- Shared types and API contracts change only through deliberate review.

## Security invariants

1. A language model cannot create VERIFIED or DENIED.
2. A language model cannot reduce the policy requirement.
3. Models never receive challenge answers, tokens, or contact secrets.
4. Raw suspicious messages are not stored by default.
5. No response, timeout, invalid output, and low confidence are never approval.
6. Never describe a request as safe, definitely legitimate, or guaranteed.
7. Verification destinations come from calm-time enrollment.
8. Tokens are CSPRNG-generated, SHA-256 hashed at rest, single-use, and expiring.
9. Token consumption and terminal state transition are atomic in Postgres.
10. Used, expired, malformed, and unknown tokens are rejected.
11. Twilio signatures are validated whenever its auth token is configured.
12. The P0 phone flow records and transcribes no audio.
13. Secrets and private data do not enter logs, analytics, bundles, or errors.
14. The service-role key is server-only.
15. Any system failure preserves or increases friction.
16. Result copy states its source and does not overclaim what a mismatch proves.

Allowed transitions: `RECEIVED -> PAUSED -> PENDING`, then only `PENDING ->
VERIFIED|DENIED|EXPIRED`.

## Commands

`npm run dev`, `npm run lint`, `npm run typecheck`, `npm test`, `npm run build`.

Future agents must preserve these boundaries, add tests for trust-state changes,
and never introduce a client-side direct database status write.
