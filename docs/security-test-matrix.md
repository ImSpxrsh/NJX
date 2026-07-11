# Security Test Matrix (CC-502)

Maps each security invariant in CLAUDE.md to its implementation and test coverage.

## Critical Invariants

| Invariant | Implementation | Test | Manual Review |
|-----------|---------------|------|---------------|
| Policy level can only be raised, never lowered | `src/lib/policy/evaluate-policy.ts` | `evaluate-policy.test.ts` | PR review gate |
| Deterministic extractor always runs first | `src/lib/evidence/llm-extractor.ts:LlmEvidenceExtractor.extract` | `llm-extractor.test.ts` | — |
| Model cannot lower a deterministic signal | `src/lib/evidence/llm-extractor.ts:combineEvidence` | `llm-extractor.test.ts` | Ensemble ADR review |
| Adversarial inputs cannot produce VERIFIED | `src/lib/evidence/adversarial.test.ts` | `adversarial.test.ts` (10 cases) | Per PR |
| Raw message never persisted | Route handlers omit message from DB writes | `analyze/route.test.ts` | Code review |
| Token consumed exactly once | `src/lib/security/tokens.ts` | `tokens.test.ts` | — |
| Demo mode requires explicit opt-in | `src/lib/runtime-config.ts` | `runtime-config.test.ts` | — |
| Demo contact URL never in production responses | `src/lib/api/analyze-response.ts` | `analyze-response.test.ts` | — |
| Rate limiting on all public endpoints | `src/lib/security/rate-limit.ts` | `rate-limit.test.ts` | — |
| Twilio signature validated on callbacks | `src/lib/security/twilio-signature.ts` | `twilio-signature.test.ts` | — |
| CSRF check on demo reset | `src/app/api/demo/reset/route.ts` | `route.test.ts` | — |
| Security headers on all responses | `next.config.ts` | `headers.test.ts` | CSP audit |

## Coverage Gaps

- No integration test verifying demo contact URL is absent from production build responses end-to-end.
- No automated test for Supabase RLS policies (requires staging database).
- No test for HSTS in production (requires HTTPS environment).
- `CALL_ME` flow lacks an E2E test verifying the check remains PENDING.

## Manual Review Requirements

- Any change to `evaluate-policy.ts` requires written threat analysis in the PR.
- Any change to token creation/consumption requires captain review.
- Any new external API call must be reviewed for data minimization.
