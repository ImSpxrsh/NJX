import "server-only";

export function normalizePhoneE164(
  value: string | null | undefined,
): string | null {
  if (!value) return null;
  const compact = value.replace(/[\s().-]/g, "");
  if (/^\+\d{7,15}$/.test(compact)) return compact;
  if (/^\d{10}$/.test(compact)) return `+1${compact}`;
  return null;
}
