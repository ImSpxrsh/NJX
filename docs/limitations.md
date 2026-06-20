# Limitations

- The policy score is not a calibrated fraud probability.
- CircleCheck is not a deepfake detector.
- This prototype does not provide production identity proofing.
- Twilio is a coordination channel, not cryptographic identity proof.
- Compromised trusted devices and SIM swaps remain possible.
- Enrollment, destination verification, account recovery, and abusive-contact
  handling require production design.
- The runnable demo repository is process-local and non-durable; deploy the
  Supabase repository before multi-instance use.
- Trusted-contact delivery is simulated by a demo link.
- Enrollment destination verification (CC-202) exists end-to-end in demo mode,
  but production secret delivery depends on the notification service (CC-203), and
  the Supabase enrollment repository ships with the broader Supabase work.
- Enrollment rate limiting is in-process and suits single-instance pilots only;
  multi-instance deployments need a shared store (CC-503).
- Destination normalization is conservative and dependency-free; it is not full
  carrier-grade E.164 validation or a deliverability check.
- The LLM provider is an interface with deterministic fallback, not a live model
  integration.
- Small usability tests would not establish efficacy.
- The Family Challenge Matrix is a P1 placeholder only.
