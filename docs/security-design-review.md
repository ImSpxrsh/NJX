# Security Design Review (CC-601)

## Data Flow Diagram

```
User browser
    │
    │ POST /api/analyze  (message text only)
    ▼
Next.js API Route (server-only)
    │
    ├─→ RuntimeConfig validation (env vars at startup)
    ├─→ Rate limiter (IP-keyed, in-process)
    ├─→ DeterministicExtractor → signals
    ├─→ [Optional] AnthropicEvidenceProvider → signals
    ├─→ combineEvidence (conservative merge)
    ├─→ evaluatePolicy → level (L0–L3)
    ├─→ Check written to Supabase (no message text stored)
    ├─→ NotificationService → Twilio (if L2+)
    └─→ serializeAnalyzeResponse → client response (no raw message)

Enrolled contact
    │
    │ GET /verify/:token  (token in URL)
    ▼
Next.js page (server render)
    │
    ├─→ verificationContext (token → minimal check context, no message)
    ├─→ Contact responds (CONFIRM / DENY / CALL_ME)
    ├─→ Token consumed (one-time use)
    └─→ Check status updated (VERIFIED / DENIED / PENDING)
```

## Trust Boundaries

| Boundary                 | Crossing          | Control                                                 |
| ------------------------ | ----------------- | ------------------------------------------------------- |
| Internet → API routes    | All requests      | Rate limiting, input validation (Zod), security headers |
| API routes → Supabase    | service_role      | Env var secret, server-only                             |
| API routes → Twilio      | Auth token        | Env var secret, server-only                             |
| API routes → Anthropic   | API key           | Env var secret, server-only, input size limit           |
| Twilio → `/api/twilio/*` | Webhook callbacks | HMAC signature validation                               |
| Demo reset → server      | POST              | Origin header CSRF check against publicAppUrl           |

## Terminal State Transitions

```
PENDING → VERIFIED  (enrolled contact confirms; statusSource = ENROLLED_CONTACT)
PENDING → DENIED    (enrolled contact denies; statusSource = ENROLLED_CONTACT)
PENDING → EXPIRED   (TTL sweep; statusSource = SYSTEM_EXPIRY)
PENDING → PENDING   (CALL_ME response; check stays open)
```

Once a check reaches VERIFIED, DENIED, or EXPIRED, no further transitions are allowed.

## Contact Enrollment Security

- Destination verified before enrollment completes (OTP to phone/email).
- Enrolled destination is hashed before storage — raw phone/email not stored.
- Re-verification required if destination changes.
- Enrollment tokens are single-use with 24-hour TTL.

## Token Lifecycle

1. Token generated server-side (cryptographically random, 32 bytes).
2. Token hashed for storage; plaintext sent to contact in URL.
3. On first use: token marked consumed with timestamp.
4. Subsequent use: 410 Gone response, no action.
5. After TTL: 410 Gone response.
6. Token URLs redacted in all logs.

## Twilio Assumptions

- Twilio is trusted to deliver alerts to the enrolled number.
- CircleCheck trusts the Twilio webhook but validates HMAC signatures.
- If Twilio is compromised, an attacker could forge contact responses — mitigated by: (a) the check stays PENDING without a valid token, (b) tokens are single-use.

## Model Boundary

- The LLM receives: system instructions (hardcoded), wrapped user message (untrusted-data delimiters).
- The LLM never receives: household IDs, contact data, tokens, phone numbers, challenge values, or verification state.
- LLM output is validated by Zod schema before any field is used.
- A prompt injection cannot change the policy level (deterministic floor).

## Logging Security

Enforced by `src/lib/security/redact.ts`:

- No raw message text in logs.
- No token URLs.
- No contact destinations.
- No auth headers or service-role keys.
- Allowed: request ID, route, coarse result code, duration, policy level, extractor version.

## Abuse Scenarios

| Scenario                     | Mitigation                                                            |
| ---------------------------- | --------------------------------------------------------------------- |
| Spam the analyze endpoint    | Rate limit: 5 requests / minute per IP                                |
| Enumerate check IDs          | Check IDs are UUIDs; status endpoint requires valid ID                |
| Replay a verification token  | Tokens are single-use; second use returns 410                         |
| Demo reset from wrong origin | CSRF check: origin must match publicAppUrl                            |
| Inject into LLM prompt       | Untrusted-data delimiters; Zod output validation; deterministic floor |
| Forge Twilio callback        | HMAC signature required                                               |

## Unresolved Risks

1. In-process rate limiter does not survive restarts or scale across instances. For production, replace with Redis-backed rate limiting.
2. Verification token in the URL path is visible in server access logs if not redacted at the reverse-proxy level.
3. No brute-force protection on the verification token URL beyond rate limiting.
