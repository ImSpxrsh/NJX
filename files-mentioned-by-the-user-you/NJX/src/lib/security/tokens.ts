import { randomBytes } from "node:crypto";
import { sha256 } from "./hashing";

export const TOKEN_BYTES = 32;
export const TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/;

export function createVerificationToken() {
  const rawToken = randomBytes(TOKEN_BYTES).toString("base64url");
  return { rawToken, tokenHash: sha256(rawToken) };
}

export function isValidTokenFormat(token: string): boolean {
  return TOKEN_PATTERN.test(token);
}
