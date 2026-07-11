# ADR-006: Notification Provider Abstraction

**Date:** 2026-06-20
**Status:** Accepted
**Deciders:** Captain, backend engineer

## Context

CircleCheck needs to send alerts to trusted contacts when a check is submitted. Twilio is the initial provider for phone-based alerts. The architecture must allow adding email or other channels without spreading provider-specific code across the codebase.

## Decision

All notification sends go through a `NotificationService` interface (`src/lib/notifications/`). Concrete implementations (Twilio voice, SMS) are injected at the call site. The interface exposes `sendAlert(checkId, destination, message)` and hides transport details. New providers implement the interface without touching callers.

## Alternatives Considered

- **Direct Twilio SDK calls in route handlers:** Rejected. Creates tight coupling and makes testing expensive.
- **Generic webhook abstraction:** Rejected as over-engineering for current scope.

## Consequences

- Adding an email provider requires implementing the interface, not modifying callers.
- Tests mock the interface rather than the Twilio SDK.
- Provider selection is determined at startup, not per-request, keeping the runtime config simple.

## Security Impact

Provider credentials (`TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`) are server-only and never reach the client. The abstraction boundary also ensures that no raw phone numbers are passed beyond the service layer.
