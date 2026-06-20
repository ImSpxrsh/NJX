import { sha256 } from "./hashing";

/**
 * Minimal in-process fixed-window rate limiter.
 *
 * It is intentionally storage-free: counters auto-expire at the end of each
 * window, so no identifier (including any caller-supplied network hint) is
 * retained beyond the window. Callers that key on a network hint must pass it
 * through {@link rateLimitKey}, which hashes the value so raw addresses are never
 * stored even transiently in the map keys.
 *
 * This is adequate for the demo repository and single-instance pilots. A
 * multi-instance production deployment must back limits with a shared store
 * (documented as CC-503 follow-up).
 */
export type RateLimitResult = {
  allowed: boolean;
  remaining: number;
  retryAfterMs: number;
};

type Window = { count: number; resetAt: number };

export class FixedWindowRateLimiter {
  private readonly hits = new Map<string, Window>();

  constructor(
    private readonly limit: number,
    private readonly windowMs: number,
    private readonly now: () => number = () => Date.now(),
  ) {}

  check(key: string): RateLimitResult {
    const ts = this.now();
    this.prune(ts);
    const existing = this.hits.get(key);
    if (!existing || existing.resetAt <= ts) {
      this.hits.set(key, { count: 1, resetAt: ts + this.windowMs });
      return { allowed: true, remaining: this.limit - 1, retryAfterMs: 0 };
    }
    if (existing.count >= this.limit) {
      return {
        allowed: false,
        remaining: 0,
        retryAfterMs: existing.resetAt - ts,
      };
    }
    existing.count += 1;
    return {
      allowed: true,
      remaining: this.limit - existing.count,
      retryAfterMs: 0,
    };
  }

  reset(): void {
    this.hits.clear();
  }

  private prune(ts: number): void {
    for (const [key, window] of this.hits) {
      if (window.resetAt <= ts) this.hits.delete(key);
    }
  }
}

/**
 * Derive a stable, non-reversible limiter key from coarse factors. Any network
 * hint is hashed so raw addresses never become map keys.
 */
export function rateLimitKey(scope: string, ...factors: string[]): string {
  return `${scope}:${sha256(factors.join("|"))}`;
}
