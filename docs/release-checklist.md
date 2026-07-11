# Release Checklist (CC-605)

This checklist covers a production or demo deployment. Complete every item in order. Do not skip items for time.

## Pre-Deployment

- [ ] All CI checks pass on the release branch (green on GitHub Actions).
- [ ] `npm run typecheck` passes locally.
- [ ] `npm test` passes locally with no skipped tests.
- [ ] `npm run build` succeeds with production env vars.
- [ ] No `TODO:`, `FIXME:`, or `HACK:` comments introduced in this release that are not in a tracked issue.
- [ ] `SUPABASE_SERVICE_ROLE_KEY`, `TWILIO_AUTH_TOKEN`, `TWILIO_ACCOUNT_SID`, and (if LLM enabled) `EVIDENCE_ANTHROPIC_API_KEY` are set in Vercel environment and not in source code.
- [ ] `PUBLIC_APP_URL` matches the target deployment URL exactly (used for demo reset CSRF, verification links).
- [ ] Database migrations applied to the production Supabase project and verified.

## Deployment

- [ ] Deploy to Vercel (preview first, then promote to production).
- [ ] Verify the deployment URL loads without console errors.
- [ ] Confirm all required environment variables are set in the deployed environment (Vercel → Project → Environment Variables).

## Smoke Tests

- [ ] Submit a sample message on the analyze page; confirm a result (any level) is returned.
- [ ] If demo mode: confirm demo contacts are shown and the check can be advanced.
- [ ] If live mode: confirm a real Twilio notification is sent to the enrolled number.
- [ ] Verification link for a PENDING check opens, loads the contact response form, and allows submission.
- [ ] A submitted verification response updates the check status (poll or realtime).
- [ ] Expired check shows the correct expired state in the UI.
- [ ] Security headers present in response: `Content-Security-Policy`, `X-Frame-Options`, `X-Content-Type-Options`.

## Post-Deployment

- [ ] Monitor Vercel function logs for the first 15 minutes: no 5xx errors, no uncaught exceptions.
- [ ] Confirm Supabase connection pool is not exhausted (check Supabase dashboard).
- [ ] Confirm rate limiting is active: submit 6 analyze requests in under a minute; sixth should return 429.
- [ ] Document the release in the project's changelog or commit message.

## Rollback Criteria

Immediately roll back to the previous deployment if any of the following occur within 30 minutes of deployment:

- Any 5xx error rate above 1% of requests.
- Analyze endpoint returns incorrect policy levels for known test messages.
- Verification tokens are not consumed after use (double-use allowed).
- Supabase writes failing (check writes or status updates not persisting).

Rollback: Vercel dashboard → Deployments → select the previous deployment → Promote to Production.

## Notes for Demo Deployments

- Set `CIRCLECHECK_RUNTIME_MODE=demo` and `CIRCLECHECK_REPOSITORY_MODE=demo`.
- Set `CIRCLECHECK_DEMO_DEPLOYMENT=true` to enable the demo reset endpoint.
- Demo reset endpoint (`/api/demo/reset`) is CSRF-protected by origin check — ensure `PUBLIC_APP_URL` is correct.
- No real Twilio calls are made in demo mode.
