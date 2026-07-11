# Dependency and Supply-Chain Policy (CC-508)

## Criteria for Adding Dependencies

Before adding any package:

1. **Is it necessary?** The feature must not be achievable with <20 lines of project code.
2. **Is it maintained?** Last release within 12 months; issues respond within 30 days.
3. **Is it minimal?** Prefer packages with no transitive dependencies for security-sensitive code.
4. **Is it audited?** Run `npm audit` before and after. Zero critical vulnerabilities required.
5. **Is it scoped?** Dev-only packages (`--save-dev`) must not appear in production bundle.

**Prohibition:** No client-side package that requires server secrets (API keys, tokens) may be added. All secret-bearing calls must be server-only (`"use server"` or API routes).

## Lockfile Review

- `package-lock.json` is committed and must be in sync with `package.json`.
- The lock file was generated with npm 11.x. CI upgrades to npm@11 before `npm ci`.
- Any PR that modifies `package.json` must also update `package-lock.json`.
- PRs with unexpected lock file churn (hundreds of changed packages) require captain review.

## Audit Response

- `npm audit` runs in CI. Any **critical** or **high** severity finding blocks merge.
- **Moderate** findings: document in the PR and create a tracking issue within 7 days.
- **Low** findings: acknowledge in PR; resolve within 30 days.
- Emergency patches: captain can merge a lock-file-only update without full PR review, with post-merge review within 24 hours.

## Update Cadence

- Direct dependencies: reviewed monthly, updated within 30 days of a security release.
- Transitive dependencies: updated as part of regular `npm update` runs, quarterly minimum.

## Package Provenance Review

For packages in the security-sensitive path (`src/lib/security/`, `src/lib/runtime-config.ts`, `src/lib/evidence/`):

- Verify the package is published by its stated maintainer on the npm registry.
- Check that the package's GitHub repository matches the registry source.
- Do not add packages with install scripts (`preinstall`, `postinstall`) without explicit captain approval.

## Emergency Patching

1. Captain opens a draft PR with only the lock file change.
2. Brief description of the CVE and affected version.
3. CI must pass; no other changes allowed in the patch PR.
4. Merge with captain + one other reviewer.
5. Post-merge: update this doc if the policy was inadequate.
