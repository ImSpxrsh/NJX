# Evidence Error Analysis (CC-603)

## Methodology

Errors are classified by failure mode using the evaluation dataset (`evals/dataset.jsonl`). Each case has a ground-truth label and a deterministic extractor result. LLM extractor results are logged separately when the provider is configured.

## Failure Mode Classification

### 1. Missed Credential Request

The message contains an OTP, password, or code request but `credentials.present` is false.

**Root cause in deterministic extractor:** Pattern list does not cover the phrasing used (e.g., "share your one-time passcode" instead of "verification code").

**Mitigation:** Expand pattern list in `deterministic-extractor.ts`. Add new cases to `evals/dataset.jsonl`. Verify no regression on true-negative cases.

### 2. Missed Payment Request

The message requests a financial transfer but `payment.present` is false.

**Common patterns missed:** Indirect phrasing ("top up my account," "load a card"), cryptocurrency ("send ETH"), gift card brands not in the list.

**Mitigation:** Add brand and phrasing variants to the payment signal patterns.

### 3. Missed Changed Contact

The message asks the recipient to contact the sender via a new number or channel but `changedContact.present` is false.

**Common patterns missed:** Requests to switch to WhatsApp or Signal, "use this number instead," "my old number is broken."

### 4. Over-triggered Urgency

The message is not actually urgent or high-risk but `urgency.score` is elevated.

**Common false positives:** Customer service messages with deadlines, legitimate appointment reminders, news alerts.

**Mitigation:** Tighten the urgency pattern to require both a deadline _and_ a financial or credential element.

### 5. Span Quality

Extracted spans (evidence text) are too long, too short, or point to the wrong part of the message.

**Impact:** Span quality affects the summary shown to the user but not the policy level. Low-quality spans reduce user trust without causing harm.

### 6. Schema Failure

The extractor returns an object that fails `evidenceExtractionSchema.parse()`.

**Cause:** LLM output only. The deterministic extractor always returns a valid schema.

**Mitigation:** Any schema failure triggers `fallbackUsed: true` and the deterministic result is used. The failure rate should be tracked per model version.

### 7. Provider Failure

The LLM provider times out, returns a non-200 status, or the API key is invalid.

**Current timeout:** 4000ms (`EVIDENCE_ANTHROPIC_TIMEOUT_MS`).

**Mitigation:** Deterministic fallback activates. No user impact beyond reduced extraction quality.

### 8. Deterministic/Model Disagreement

The deterministic and model extractors disagree on a signal.

**Result:** `uncertainty: true` is set. The policy evaluates the more conservative combined result.

**Tracking:** Disagreement rate by signal is a useful quality metric. High disagreement on `urgency` is expected; high disagreement on `credentials` warrants investigation.

## Optimization Guidelines

Before expanding any pattern list:

1. Identify which cases improve (by re-running `evals/`).
2. Identify what regressions could occur (run the full eval set).
3. Quantify: how many true positives gained vs. true negatives lost.
4. Do not expand patterns if the false positive rate rises above 5% on the negative-case set.
