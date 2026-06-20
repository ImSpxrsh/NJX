const sensitiveKeys =
  /token|authorization|auth.?header|service.?role|auth.?token|password|phone|e164|destination|verification.?url|contact/i;

export function redactSensitive(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(redactSensitive);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, nested]) => [
        key,
        sensitiveKeys.test(key) ? "[REDACTED]" : redactSensitive(nested),
      ]),
    );
  }
  return value;
}
