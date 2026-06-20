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
