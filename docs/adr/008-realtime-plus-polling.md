# ADR-008: Realtime Plus Polling Fallback

**Date:** 2026-06-20
**Status:** Accepted
**Deciders:** Frontend engineer, backend engineer, captain

## Context

The check status page must update when an enrolled contact responds. Two options are available: Supabase Realtime subscriptions and HTTP polling. Realtime is lower-latency but adds a WebSocket dependency. Polling is reliable but adds load.

## Decision

Implement polling as the primary mechanism with a 3-second interval (`POLL_INTERVAL_MS`). The interval is cleared on component unmount. `VERIFIED` is only displayed when `statusSource === "ENROLLED_CONTACT"` — no transient client event alone can trigger a VERIFIED display; the status endpoint is always the authority.

Supabase Realtime subscription can be layered on top in a future PR without changing the polling contract. If the subscription fires, the component still fetches the authoritative status endpoint before displaying VERIFIED.

## Alternatives Considered

- **Realtime-only:** Rejected for initial implementation. WebSocket setup complexity adds risk without validated need.
- **Long-polling:** Rejected. Adds server complexity without meaningful latency improvement over short polling at the pilot scale.

## Consequences

- Simple to reason about and test.
- Slightly higher server load than push-based, acceptable at pilot scale.
- Adding Realtime later is additive, not a breaking change.

## Security Impact

Short-polling the status endpoint means each poll is an authenticated request. The client cannot forge a VERIFIED state — only the server authorizes terminal states.
