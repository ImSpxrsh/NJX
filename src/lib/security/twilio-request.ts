import "server-only";

export async function parseTwilioParams(
  request: Request,
): Promise<Record<string, string>> {
  const contentType = request.headers.get("content-type") ?? "";
  if (
    contentType.includes("application/x-www-form-urlencoded") ||
    contentType.includes("multipart/form-data")
  ) {
    const form = await request.formData();
    return Object.fromEntries(
      [...form.entries()].map(([key, value]) => [key, String(value)]),
    );
  }
  return Object.fromEntries(new URLSearchParams(await request.text()));
}
