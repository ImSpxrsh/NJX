import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  join(process.cwd(), "supabase/migrations/001_circlecheck_foundation.sql"),
  "utf8",
);

const functionBody = migration.slice(
  migration.indexOf("create or replace function public.consume_verification_token"),
  migration.indexOf(
    "revoke all on function public.consume_verification_token",
  ),
);

describe("consume_verification_token migration", () => {
  it("hashes and validates the supplied token inside Postgres", () => {
    expect(functionBody).toContain("digest(supplied_token, 'sha256')");
    expect(functionBody).toContain("supplied_token !~");
  });

  it("locks the request and associated pending check before consuming", () => {
    expect(functionBody).toContain("for update of vr, c");
    expect(functionBody).toContain("c.state = 'PENDING'");
  });

  it("rejects superseded requests and returns generic failures", () => {
    expect(functionBody).toContain("not exists");
    expect(functionBody).toContain("'REJECTED'");
    expect(functionBody).not.toContain("raise exception");
  });
});
