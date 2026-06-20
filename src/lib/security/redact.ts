const sensitiveKeys = /token|authorization|service.?role|auth.?token|password/i;

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
