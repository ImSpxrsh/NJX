import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "./route";

const expirePendingChecks = vi.fn();

vi.mock("@/lib/repository/factory", () => ({
  getRepositories: () => ({
    expiry: { expirePendingChecks },
  }),
}));

function request(secret?: string): Request {
  return new Request("https://example.test/api/cron/expire", {
    method: "POST",
    headers: secret ? { authorization: `Bearer ${secret}` } : undefined,
  });
}

describe("POST /api/cron/expire", () => {
  beforeEach(() => {
    process.env.CRON_SECRET = "test-secret";
    expirePendingChecks.mockResolvedValue({
      expiredChecks: 2,
      expiredRequests: 3,
    });
  });

  afterEach(() => {
    delete process.env.CRON_SECRET;
    expirePendingChecks.mockReset();
  });

  it("rejects requests without the cron secret", async () => {
    const response = await POST(request());

    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ ok: false });
    expect(expirePendingChecks).not.toHaveBeenCalled();
  });

  it("fails closed when the cron secret is not configured", async () => {
    delete process.env.CRON_SECRET;

    const response = await POST(request("test-secret"));

    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ ok: false });
    expect(expirePendingChecks).not.toHaveBeenCalled();
  });

  it("runs expiry with the configured cron secret", async () => {
    const response = await POST(request("test-secret"));

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      ok: true,
      expiredChecks: 2,
      expiredRequests: 3,
    });
  });
});
