# ADR-007: Extractor Ensemble Behavior

**Date:** 2026-06-20
**Status:** Accepted
**Deciders:** Evidence engineer, captain

## Context

CircleCheck uses both a deterministic rule extractor and an optional LLM extractor. Results must be combined without allowing the model to soften a deterministic warning signal.

## Decision

The ensemble uses a conservative merge rule (`combineEvidence` in `src/lib/evidence/llm-extractor.ts`):

1. Run deterministic extraction on every request.
2. Optionally run the LLM provider (if configured and available).
3. For each signal, take the more conservative result: if deterministic marks `present: true`, the combined result is `present: true` regardless of model output.
4. If extractors disagree materially, set `uncertainty: true`.
5. On any provider failure (timeout, malformed output, exception), fall back to the deterministic result alone with `fallbackUsed: true`.
6. Deterministic policy runs on the combined result, never on the raw model output.

## Alternatives Considered

- **Model-only extraction:** Rejected. No deterministic floor means a jailbroken model can suppress payment signals.
- **Average of scores:** Rejected. Averaging allows a low model score to reduce a high deterministic score.
- **Majority vote:** Rejected. With two extractors, ties resolve arbitrarily.

## Consequences

- The model can raise a signal level but never lower one set by deterministic rules.
- Disagreement is visible in the evidence record and testable.
- Provider outages degrade gracefully to deterministic-only.

## Security Impact

This is a hard security boundary. A prompt injection that convinces the model to output `credentials.present: false` has no effect when the deterministic extractor already set it to `true`.
