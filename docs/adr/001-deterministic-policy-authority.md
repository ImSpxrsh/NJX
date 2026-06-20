# ADR-001: Deterministic Policy Authority

**Date:** 2024-06-20  
**Status:** Accepted  
**Deciders:** Captain

## Context
Evidence extraction (deterministic rules or LLM output) provides signals about message risk. The question was whether the extraction result should directly determine verification requirements or whether a separate deterministic layer should govern them.

## Decision
All verification-level decisions are made by a deterministic policy function (`evaluate-policy.ts`). No model output, user input, or extracted field can override or bypass this function. The extraction result is advisory input; policy is authoritative output.

## Consequences
- Adding or changing extraction signals requires updating the policy function separately.
- The policy function is the single source of truth for verification requirements and can be tested exhaustively without model involvement.
- Making policy less strict requires written threat analysis and captain approval (enforced in the team contract).
