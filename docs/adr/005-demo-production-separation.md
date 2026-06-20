# ADR-005: Demo / Production Separation

**Date:** 2024-06-20  
**Status:** Accepted

## Context
A demo mode is needed for local development and presentations. Initially, demo behavior (including `demoContactUrl` with embedded raw tokens) leaked into the production response path.

## Decision
- A server-side `RuntimeConfig` module (`lib/runtime-mode.ts`) is the single source of truth for demo mode.
- Demo mode requires `CIRCLECHECK_REPOSITORY_MODE=demo` with `NODE_ENV` ≠ `production`.
- Contradictory configuration (`NODE_ENV=production` + demo mode) resolves to production, never demo.
- All false-like env values (`"false"`, `"0"`, `"no"`, whitespace, etc.) are non-demo.
- Client-controlled data (query params, headers, body, cookies) cannot enable demo mode.
- Production and demo response schemas are separate strict Zod schemas; production schema throws on unexpected fields.
- `demoContactUrl` (containing a raw token) is only present in demo responses.

## Consequences
- The demo mode check must be imported before any response serialization.
- Tests that exercise demo behavior must set `CIRCLECHECK_REPOSITORY_MODE=demo` and `NODE_ENV=test`.
- A banner visible to all users must appear in demo deployments.
