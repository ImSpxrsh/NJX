# Load and Concurrency Testing Plan (CC-604)

## Scope

Realistic targets for a hackathon or small pilot deployment (10–100 concurrent households, up to 500 checks per day). This is not a plan for internet-scale capacity.

## Pilot Targets

| Scenario | Target | Acceptable latency |
|----------|--------|-------------------|
| Analyze endpoint | 20 concurrent requests | p95 < 3s |
| Status polling | 50 concurrent pollers (3s interval) | p95 < 500ms |
| Twilio callbacks | 5 concurrent | p95 < 2s |
| Verification response | 10 concurrent | p95 < 1s |

## Test Scenarios

### Simultaneous Token Responses

**Setup:** 10 contacts each receive a unique verification link. All 10 submit a response within 1 second.

**Expected behavior:** All tokens consumed exactly once. No double-apply of status update. Each check resolves to VERIFIED or DENIED independently.

**Tool:** k6 or autocannon with 10 concurrent POST requests to `/api/verification/respond`.

### Status Polling Load

**Setup:** 50 clients polling `/api/checks/:id` every 3 seconds for 5 minutes.

**Expected behavior:** Database connection pool handles concurrent reads without exhaustion. Response times stay under 500ms at p95.

### Repeated Twilio Callbacks

**Setup:** Twilio delivers the same callback event 3 times (Twilio's retry behavior on 5xx).

**Expected behavior:** Token consumed on first callback; subsequent callbacks return 4xx (idempotent). No duplicate status updates.

### Expiry Sweep Concurrency

**Setup:** 100 expired checks exist. Expiry sweep (`/api/cron/expire-checks`) runs while 10 new checks are being created.

**Expected behavior:** No deadlock or constraint violation. Newly created checks are not accidentally expired.

### Provider Timeout Burst

**Setup:** Anthropic API is throttled (mock 429 responses). 20 concurrent analyze requests arrive.

**Expected behavior:** All requests fall back to deterministic extractor. Response time increases but stays under 5s. No request fails with a 5xx.

### Database Connection Exhaustion

**Setup:** Supabase connection limit (25 for free tier, 100 for Pro) is approached.

**Expected behavior:** Requests queue rather than fail. If the limit is exceeded, requests fail gracefully with a 503 (not a 500 stack trace).

## Monitoring During Tests

- Supabase dashboard: query count, connection pool usage.
- Vercel function logs: error rate, duration percentiles.
- Anthropic API dashboard: request count, rate limit hits.

## Known Limitations

- In-process rate limiter does not share state across Vercel function instances. Under load with multiple instances, effective rate limit is `configured_limit × instance_count`.
- Connection pool size depends on Supabase plan. Free tier (25 connections) will be exhausted at approximately 25 concurrent requests.
