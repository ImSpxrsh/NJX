import { describe, expect, it } from "vitest";
import nextConfig from "../../../next.config";

describe("security headers", () => {
  it("sets browser policy and token-leakage protections", async () => {
    const headers = await nextConfig.headers?.();
    const all = headers?.flatMap((entry) => entry.headers) ?? [];
    expect(all).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ key: "Content-Security-Policy" }),
        { key: "Referrer-Policy", value: "no-referrer" },
        {
          key: "Permissions-Policy",
          value: "camera=(), microphone=(), geolocation=()",
        },
        { key: "X-Content-Type-Options", value: "nosniff" },
      ]),
    );
    expect(
      headers?.find((entry) => entry.source === "/verify/:path*")?.headers,
    ).toEqual(
      expect.arrayContaining([{ key: "Cache-Control", value: "no-store" }]),
    );
  });
});
