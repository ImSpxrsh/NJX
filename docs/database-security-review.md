# Database Authorization Review (CC-507)

## Role Matrix

| Role | Description | Access |
|------|-------------|--------|
| `service_role` | Backend server | Full access bypassing RLS |
| `anon` | Unauthenticated public | Read-only on `checks` status field only |
| `authenticated` | End-user JWT (not used currently) | Reserved for future household self-service |

## Table-by-Table Permissions

### `checks`
- `service_role`: INSERT, SELECT, UPDATE (status, contacted_at, completed_at)
- `anon`: SELECT on `(id, status, status_source, level, summary, created_at)` only — no message text, no contact data

### `contacts`
- `service_role`: INSERT, SELECT, UPDATE, DELETE
- `anon`: No access
- Rationale: Contact phone/email never exposed to the public

### `households`
- `service_role`: INSERT, SELECT, UPDATE
- `anon`: No access

### `verification_tokens`
- `service_role`: INSERT, SELECT, UPDATE (consumed_at)
- `anon`: No access — token lookup goes through service_role only

### `enrolled_contacts`
- `service_role`: INSERT, SELECT, UPDATE
- `anon`: No access

## RLS Policy Review

All tables with `anon` access use Row Level Security. The `checks` SELECT policy limits columns to non-sensitive fields. No policy exposes raw message text.

**Known gap:** RLS is enforced at the database level, but the service_role bypasses it. The application layer must enforce column-level filtering before returning data to the client. This is verified in `analyze-response.test.ts`.

## Function Execution Permissions

No `SECURITY DEFINER` functions are currently used. All database functions execute as the calling role.

## Anonymous Access Justification

The `anon` SELECT on `checks.status` is required for the contact verification page (`/verify/:token`). The page shows only the check status and policy level — no message text, no contact information, no household data.

## Remaining Risks

1. If a `service_role` key is leaked, all data is accessible. Mitigated by key rotation procedures in `docs/incident-runbook.md`.
2. No cross-household isolation is tested at the database level. Households are currently single-user, but RLS policies should be added when multi-user households are introduced.
3. `verification_tokens` table has no automatic expiry at the database level; TTL enforcement is application-layer only.
