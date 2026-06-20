import { describe, expect, it, vi } from "vitest";
import { POST } from "./route";

const respond = vi.fn();

vi.mock("@/lib/repository/factory", () => ({
  getRepositories: () => ({
    verificationRequests: { respond },
  }),
}));

function request(body: unknown): Request {
  return new Request("https://example.test/api/verification/respond", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

describe("POST /api/verification/respond", () => {
  const token = "a".repeat(43);
  const rejected = {
    ok: false,
    code: "REJECTED",
    message: "Verification response was not accepted.",
  };

  it("returns a generic rejection for malformed input", async () => {
    const response = await POST(
      request({ token: "bad", response: "CONFIRMED_MINE" }),
    );

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual(rejected);
    expect(respond).not.toHaveBeenCalled();
  });

  it("does not reveal whether a token was unknown or already used", async () => {
    respond
      .mockResolvedValueOnce({ ok: false, code: "UNKNOWN_TOKEN" })
      .mockResolvedValueOnce({ ok: false, code: "ALREADY_USED" });

    const unknown = await POST(request({ token, response: "DENIED_MINE" }));
    const used = await POST(request({ token, response: "DENIED_MINE" }));

    expect(unknown.status).toBe(409);
    expect(used.status).toBe(409);
    expect(await unknown.json()).toEqual(rejected);
    expect(await used.json()).toEqual(rejected);
  });
});
