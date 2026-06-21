# ADR-003: Supabase Repository Strategy

**Date:** 2024-06-20  
**Status:** Accepted

## Context

The application needs persistent storage for checks, verification requests, trusted contacts, households, and phone alerts. Multiple backends were considered: Supabase, PlanetScale, Neon, or a simple SQLite file.

## Decision

Supabase with service-role key access from server-only Next.js routes. An interface layer (`CircleCheckRepositories`) separates the application from the Supabase implementation. A demo in-memory implementation satisfies the same interface for local development and testing.

## Consequences

- RLS policies provide defense in depth but the primary boundary is server-only code with the service role.
- The service-role key must never appear in browser bundles or logs.
- Atomic operations use Postgres functions (RPC) to avoid multi-step races from the application layer.
