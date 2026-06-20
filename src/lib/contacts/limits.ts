// Configurable spam / abuse limits for trusted-contact enrollment and
// destination verification. All values are read from the environment with
// conservative, fail-safe defaults.

function intFromEnv(name: string, fallback: number): number {
  const raw = process.env[name];
  if (raw === undefined) return fallback;
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

export const contactLimits = {
  // Maximum destinations a single household may enroll.
  maxDestinationsPerHousehold: () =>
    intFromEnv("MAX_DESTINATIONS_PER_HOUSEHOLD", 10),

  // Maximum verification *starts* per household within the rolling window.
  maxVerificationStartsPerWindow: () =>
    intFromEnv("MAX_VERIFICATION_STARTS_PER_WINDOW", 5),
  verificationStartWindowMs: () =>
    intFromEnv("VERIFICATION_START_WINDOW_SECONDS", 3600) * 1000,

  // Maximum code submissions against a single challenge before it locks.
  maxVerificationAttemptsPerChallenge: () =>
    intFromEnv("MAX_VERIFICATION_ATTEMPTS_PER_CHALLENGE", 5),

  // Challenge lifetime and code length.
  verificationCodeTtlMs: () =>
    intFromEnv("DESTINATION_VERIFICATION_CODE_TTL_SECONDS", 600) * 1000,
  verificationCodeLength: () =>
    intFromEnv("DESTINATION_VERIFICATION_CODE_LENGTH", 6),
} as const;
