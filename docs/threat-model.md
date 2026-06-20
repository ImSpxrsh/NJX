# Threat model

## Assets and boundaries

Assets include enrolled destinations, token hashes, check status, evidence
summaries, Twilio credentials, and Supabase credentials. Trust boundaries exist
between the suspicious primary channel, browser, CircleCheck server, Twilio,
Supabase, and the enrolled contact device.

The attacker may control the incoming call/message, spoof caller ID, clone a
voice, know public family details, create urgency/secrecy, provide a new number,
repeat contact, and include prompt injection. The prototype assumes the attacker
does not control the CircleCheck server, enrolled contact device, known callback
number, or both physical challenge-card copies.

## Mitigations

- Strict Zod extraction schema and deterministic fallback.
- Fixed policy rules that model text cannot lower.
- No raw-message persistence.
- CSPRNG, hashed, expiring, single-use tokens.
- Atomic database token consumption and state transition.
- Signed Twilio webhooks validated against the reconstructed public URL, failing
  closed in production when no auth token is configured.
- No audio recording or transcription.
- Short polling returns minimal, source-labeled status.
- Failures preserve the instruction to stop and use a known number.

## Twilio webhook signature (CC-206)

The webhook signature is the only caller authentication for the phone flow.

- **Forgery** — only a holder of the auth token can produce a valid HMAC-SHA1
  signature; unsigned/invalid requests get a generic 403 and no side effects.
- **URL reconstruction** — the signed public URL is rebuilt from a pinned base
  (`TWILIO_PUBLIC_BASE_URL`/`PUBLIC_APP_URL`) or forwarded headers; path and query
  come from the request, so behind Vercel/proxies valid signatures verify and
  tampering fails.
- **Header spoofing** — a pinned base URL ignores forwarded headers entirely;
  even without it, spoofing host/scheme cannot yield a matching signature.
- **Tampering / replacement / stripping** — body, query, signature, and
  content-type changes all invalidate verification.
- **Fail-open misconfiguration** — production with no auth token rejects all
  webhooks (`NOT_CONFIGURED`); unsigned requests are allowed only with an
  explicit non-production flag.
- **Logging** — only a coarse failure code is logged; never the token, signature,
  URL, or params.

See `docs/twilio-security.md`.

## Enrollment destination verification (CC-202)

Enrollment secrets are CSPRNG-generated, purpose-bound, hashed at rest,
single-use, expiring, and rate-limited. Threats and mitigations:

- **Replay / used token** — single-use consumption; a used secret fails.
- **Brute force** — high-entropy email links; SMS codes are contact-bound with a
  strict attempt cap that locks the record; per-network confirm rate limiting.
- **Enumeration** — every confirm failure (unknown, wrong, expired, used, locked)
  collapses to one generic result; rate-limit responses reveal nothing about
  validity or enrollment state.
- **Cross-household use** — a cross-household start is an indistinguishable
  not-found; codes are bound to a contact id.
- **Token leakage via URL/logs** — links carry no identifiers; raw secrets are
  never persisted, never logged, and only returned to clients in explicit demo
  mode.
- **Destination change after verification** — changing a destination clears prior
  verification and invalidates pending secrets.
- **Failure handling** — any verification, infrastructure, or database failure
  leaves the destination unverified.

## Outside prototype scope

Production identity proofing, compromised trusted devices, SIM swaps, abusive
trusted contacts, account recovery, destination delivery, and production user
authentication are not solved here. An identity mismatch does not prove every
part of a communication was fraudulent.

The complete invariant list is normative in `CLAUDE.md`.
