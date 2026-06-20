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
- Signed Twilio webhooks when credentials are configured.
- No audio recording or transcription.
- Short polling returns minimal, source-labeled status.
- Failures preserve the instruction to stop and use a known number.

## Outside prototype scope

Production identity proofing, compromised trusted devices, SIM swaps, abusive
trusted contacts, account recovery, destination delivery, and production user
authentication are not solved here. An identity mismatch does not prove every
part of a communication was fraudulent.

The complete invariant list is normative in `CLAUDE.md`.
