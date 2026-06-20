import "server-only";
import { randomInt } from "node:crypto";
import { hashesEqual, sha256 } from "@/lib/security/hashing";

// Destination verification codes are short numeric OTPs. Like check tokens
// (lib/security/tokens), they are CSPRNG-generated and SHA-256 hashed at rest;
// the plaintext code exists only transiently while a challenge is created.

export function createDestinationCode(length: number): {
  code: string;
  codeHash: string;
} {
  let code = "";
  for (let i = 0; i < length; i += 1) {
    code += randomInt(0, 10).toString();
  }
  return { code, codeHash: sha256(code) };
}

export function codeMatchesHash(code: string, codeHash: string): boolean {
  // Constant-time comparison of the hashes avoids leaking via timing.
  return hashesEqual(sha256(code), codeHash);
}
