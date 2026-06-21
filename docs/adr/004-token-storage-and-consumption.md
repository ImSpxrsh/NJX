# ADR-004: Verification Token Storage and Consumption

**Date:** 2024-06-20  
**Status:** Accepted

## Context

Trusted contacts receive one-time verification links containing a token. The token must be unforgeable, single-use, and expiring.

## Decision

- Tokens are generated with 32 bytes (256 bits) of CSPRNG entropy, encoded as base64url (43 chars).
- Only the SHA-256 hash of the token is stored in the database.
- The raw token is returned to the generating server call exactly once and embedded in the contact's link.
- A Postgres function (`consume_verification_token`) atomically hashes the submitted token, locks the request row, validates expiry and usage, and transitions the check state — all in one transaction.
- Tokens have a configurable TTL (default 10 minutes).

## Consequences

- Even with full database read access, an attacker cannot derive or reuse tokens.
- A single-use guarantee requires the Postgres function to use `SELECT ... FOR UPDATE`.
- The raw token must never appear in logs, analytics, or error objects.
