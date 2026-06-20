import "server-only";

/**
 * Reconstruct the exact public URL that Twilio signed.
 *
 * Twilio computes its signature over the absolute webhook URL it was configured
 * to call (e.g. `https://app.example.com/api/twilio/voice`). Behind Vercel or a
 * reverse proxy, the incoming `request.url` seen by the route handler may carry
 * an internal host/scheme, so validating against `request.url` verbatim would
 * reject legitimate requests.
 *
 * Resolution order, most trustworthy first:
 *   1. A configured public base (`TWILIO_PUBLIC_BASE_URL`, else `PUBLIC_APP_URL`).
 *      This pins scheme + host and is immune to forwarded-header spoofing — the
 *      recommended production setup.
 *   2. Forwarded headers (`x-forwarded-proto` / `x-forwarded-host`) with a
 *      fallback to the `host` header. The first value of a comma-separated list
 *      is used (outermost proxy hop).
 *   3. The raw `request.url` as a last resort.
 *
 * In every case the path and query string come from the request itself, never
 * from a header, so they cannot be substituted. (Forging host/scheme cannot make
 * validation pass: the attacker would still need the auth token to produce a
 * matching signature for whatever URL is reconstructed.)
 */
export function reconstructTwilioUrl(request: Request): string {
  const incoming = new URL(request.url);
  const pathAndQuery = `${incoming.pathname}${incoming.search}`;

  const configuredBase =
    firstValue(process.env.TWILIO_PUBLIC_BASE_URL) ??
    firstValue(process.env.PUBLIC_APP_URL);
  if (configuredBase) {
    return new URL(
      pathAndQuery,
      ensureTrailingSlash(configuredBase),
    ).toString();
  }

  const forwardedProto = firstHeaderValue(
    request.headers.get("x-forwarded-proto"),
  );
  const forwardedHost =
    firstHeaderValue(request.headers.get("x-forwarded-host")) ??
    firstHeaderValue(request.headers.get("host"));

  if (forwardedHost) {
    const proto = forwardedProto ?? incoming.protocol.replace(/:$/, "");
    return `${proto}://${forwardedHost}${pathAndQuery}`;
  }

  return request.url;
}

function firstHeaderValue(header: string | null): string | undefined {
  if (!header) return undefined;
  const first = header.split(",")[0]?.trim();
  return first ? first : undefined;
}

function firstValue(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

function ensureTrailingSlash(base: string): string {
  return base.endsWith("/") ? base : `${base}/`;
}
