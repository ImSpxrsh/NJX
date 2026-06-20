/**
 * Extract a coarse network hint for abuse limiting. The value is only ever used
 * as input to {@link rateLimitKey}, which hashes it, so the raw address is never
 * stored. Returns "unknown" when no proxy header is present.
 */
export function networkHint(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0]!.trim();
  return request.headers.get("x-real-ip")?.trim() || "unknown";
}
