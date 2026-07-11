import { randomBytes } from "node:crypto";
import { sha256 } from "./hashing";

export const TOKEN_BYTES = 32;
export const TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/;
/** Same alphabet as TOKEN_PATTERN but without anchors, used for redaction. */
const TOKEN_INLINE_PATTERN = /[A-Za-z0-9_-]{43}/g;

/** Minimum allowed TTL for a verification token (60 seconds). */
export const TOKEN_TTL_MIN_MS = 60_000;
/** Maximum allowed TTL for a verification token (24 hours). */
export const TOKEN_TTL_MAX_MS = 86_400_000;
/** Default TTL: 15 minutes. */
export const TOKEN_TTL_DEFAULT_MS = 900_000;

export function createVerificationToken() {
  const rawToken = randomBytes(TOKEN_BYTES).toString("base64url");
  return { rawToken, tokenHash: sha256(rawToken) };
}

export function isValidTokenFormat(token: string): boolean {
  return TOKEN_PATTERN.test(token);
}

/**
 * Returns the TTL in milliseconds from the environment variable
 * VERIFICATION_TOKEN_TTL_MS, clamped to [TOKEN_TTL_MIN_MS, TOKEN_TTL_MAX_MS].
 * Falls back to TOKEN_TTL_DEFAULT_MS if the env var is absent or invalid.
 */
export function resolveTokenTtlMs(): number {
  const raw = process.env.VERIFICATION_TOKEN_TTL_MS;
  if (!raw) return TOKEN_TTL_DEFAULT_MS;
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed <= 0) return TOKEN_TTL_DEFAULT_MS;
  return Math.min(Math.max(parsed, TOKEN_TTL_MIN_MS), TOKEN_TTL_MAX_MS);
}

/**
 * Returns an ISO-8601 expiry timestamp `ttlMs` milliseconds from now.
 * Uses resolveTokenTtlMs() if ttlMs is not provided.
 */
export function tokenExpiresAt(ttlMs?: number): string {
  return new Date(Date.now() + (ttlMs ?? resolveTokenTtlMs())).toISOString();
}

/**
 * Redacts a raw verification token from a string, replacing it with [REDACTED].
 * Tokens match TOKEN_PATTERN (43 base64url chars). This is the safe form to use
 * before passing any URL or message to a logger.
 */
export function redactToken(value: string): string {
  return value.replace(TOKEN_INLINE_PATTERN, "[REDACTED]");
}

/**
 * Creates a replacement token that is cryptographically independent of the
 * original. Used when a consumed token must be superseded (e.g. CALL_ME
 * response: check stays open, contact can re-verify with a new link).
 *
 * The caller is responsible for persisting the new hash and revoking the old
 * one atomically in the database.
 */
export function rotateVerificationToken(): {
  rawToken: string;
  tokenHash: string;
} {
  return createVerificationToken();
}
