# ADR-002: Raw Message Non-Persistence

**Date:** 2024-06-20  
**Status:** Accepted

## Context

Suspicious messages may contain personal information, financial details, or emotionally sensitive content. Storing them increases the blast radius of a database breach and creates privacy obligations.

## Decision

Raw suspicious messages are ephemeral. Only the sanitized plain-language summary, evidence signals, and policy reasons are persisted. The original message text is never written to the database, logs, analytics, or third-party services.

## Consequences

- Debugging extraction quality requires synthetic or permissioned dataset examples, not production messages.
- Incident investigation cannot recover original message text from the database.
- Users have a clear expectation that their message content is not retained.
