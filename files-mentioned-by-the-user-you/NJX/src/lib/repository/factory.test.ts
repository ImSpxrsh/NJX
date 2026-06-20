import { describe, expect, it } from "vitest";
import type { CircleCheckRepositories } from "./contracts";
import { createRepositories, resolveRepositoryMode } from "./factory";
import { createDemoRepositories } from "./demo-store";

describe("repository factory", () => {
  it("requires an explicit supported mode", () => {
    expect(resolveRepositoryMode("demo")).toBe("demo");
    expect(resolveRepositoryMode("supabase")).toBe("supabase");
    expect(() => resolveRepositoryMode(undefined)).toThrow(
      "must be explicitly set",
    );
    expect(() => resolveRepositoryMode("memory")).toThrow(
      "must be explicitly set",
    );
  });

  it("selects the requested provider", () => {
    const demo = createDemoRepositories();
    const supabase = createDemoRepositories();
    expect(
      createRepositories("demo", {
        demo: () => demo,
        supabase: () => supabase,
      }),
    ).toBe(demo);
    expect(
      createRepositories("supabase", {
        demo: () => demo,
        supabase: () => supabase,
      }),
    ).toBe(supabase);
  });

  it("fails closed when Supabase mode has no implementation", () => {
    expect(() =>
      createRepositories("supabase", {
        demo: createDemoRepositories,
      }),
    ).toThrow("no Supabase repository implementation");
  });

  it("exposes all repository boundaries", () => {
    const repositories: CircleCheckRepositories = createDemoRepositories();
    expect(Object.keys(repositories)).toEqual(
      expect.arrayContaining([
        "checks",
        "trustedContacts",
        "verificationRequests",
        "phoneAlerts",
        "households",
      ]),
    );
  });
});
