import { describe, expect, it } from "vitest";
import {
  createVerificationToken,
  isValidTokenFormat,
  TOKEN_BYTES,
} from "./tokens";

describe("verification tokens", () => {
  it("uses 256 bits of entropy and stores a distinct hash", () => {
    const token = createVerificationToken();
    expect(TOKEN_BYTES).toBeGreaterThanOrEqual(16);
    expect(isValidTokenFormat(token.rawToken)).toBe(true);
    expect(token.tokenHash).not.toContain(token.rawToken);
    expect(token.tokenHash).toHaveLength(64);
  });

  it("rejects malformed values", () => {
    expect(isValidTokenFormat("short")).toBe(false);
    expect(isValidTokenFormat("a".repeat(43))).toBe(true);
  });
});
