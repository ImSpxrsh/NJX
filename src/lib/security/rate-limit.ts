import "server-only";
import { sha256 } from "./hashing";

type Bucket = {
  count: number;
  resetAt: number;
};

export type RateLimitResult = {
  allowed: boolean;
  remaining: number;
  retryAfterMs: number;
  retryAfterSeconds: number;
};

const buckets = new Map<string, Bucket>();

export class FixedWindowRateLimiter {
  private readonly hits = new Map<string, Bucket>();

  constructor(
    private readonly limit: number,
    private readonly windowMs: number,
    private readonly now: () => number = () => Date.now(),
  ) {}

  check(key: string): RateLimitResult {
    const now = this.now();
    const current = this.hits.get(key);
    if (!current || current.resetAt <= now) {
      this.hits.set(key, { count: 1, resetAt: now + this.windowMs });
      return {
        allowed: true,
        remaining: this.limit - 1,
        retryAfterMs: 0,
        retryAfterSeconds: 0,
      };
    }
    if (current.count >= this.limit) {
      const retryAfterMs = Math.max(1, current.resetAt - now);
      return {
        allowed: false,
        remaining: 0,
        retryAfterMs,
        retryAfterSeconds: Math.max(1, Math.ceil(retryAfterMs / 1000)),
      };
    }
    current.count += 1;
    return {
      allowed: true,
      remaining: this.limit - current.count,
      retryAfterMs: 0,
      retryAfterSeconds: 0,
    };
  }

  reset(): void {
    this.hits.clear();
  }
}

export function rateLimit(input: {
  name: string;
  key: string;
  limit: number;
  windowMs: number;
  now?: number;
}): RateLimitResult {
  const now = input.now ?? Date.now();
  const bucketKey = `${input.name}:${sha256(input.key).slice(0, 32)}`;
  const current = buckets.get(bucketKey);
  if (!current || current.resetAt <= now) {
    buckets.set(bucketKey, { count: 1, resetAt: now + input.windowMs });
    return {
      allowed: true,
      remaining: input.limit - 1,
      retryAfterMs: 0,
      retryAfterSeconds: 0,
    };
  }
  if (current.count >= input.limit) {
    const retryAfterMs = Math.max(1, current.resetAt - now);
    return {
      allowed: false,
      remaining: 0,
      retryAfterMs,
      retryAfterSeconds: Math.max(1, Math.ceil(retryAfterMs / 1000)),
    };
  }
  current.count += 1;
  return {
    allowed: true,
    remaining: input.limit - current.count,
    retryAfterMs: 0,
    retryAfterSeconds: 0,
  };
}

export function rateLimitKeyFromRequest(
  request: Request,
  extra = "global",
): string {
  const forwarded = request.headers
    .get("x-forwarded-for")
    ?.split(",")[0]
    ?.trim();
  const ip = forwarded || request.headers.get("x-real-ip") || "unknown-network";
  return `${ip}:${extra}`;
}

export function rateLimitKey(scope: string, ...factors: string[]): string {
  return `${scope}:${sha256(factors.join("|"))}`;
}

export function resetRateLimitsForTests(): void {
  buckets.clear();
}
