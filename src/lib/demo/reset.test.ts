import { describe, expect, it, vi } from "vitest";
import type { CircleCheckRepositories } from "@/lib/repository/contracts";
import { createDemoRepositories } from "@/lib/repository/demo-store";
import { resolveRuntimeConfig } from "@/lib/runtime-config";
import { executeDemoReset } from "./reset";

describe("demo reset boundary", () => {
  it.each([
    { nodeEnv: "production", runtimeMode: "production" },
    { nodeEnv: "development", runtimeMode: "development" },
    { nodeEnv: "test", runtimeMode: "test" },
  ])("returns 404 without constructing repositories", async (environment) => {
    const repositories = vi.fn<() => CircleCheckRepositories>();
    const response = await executeDemoReset({
      runtime: resolveRuntimeConfig({
        ...environment,
        repositoryMode: "supabase",
      }),
      requestOrigin: "https://attacker.test",
      repositories,
    });
    expect(response.status).toBe(404);
    expect(repositories).not.toHaveBeenCalled();
    expect(JSON.stringify(await response.json())).not.toMatch(
      /token|verification|household/i,
    );
  });

  it("permits reset only in explicit demo mode and same origin", async () => {
    const resetDemo = vi.fn(async () => {});
    const response = await executeDemoReset({
      runtime: resolveRuntimeConfig({
        nodeEnv: "development",
        runtimeMode: "demo",
        repositoryMode: "demo",
        publicAppUrl: "https://demo.circlecheck.test",
      }),
      requestOrigin: "https://demo.circlecheck.test",
      repositories: () => ({
        ...createDemoRepositories(),
        resetDemo,
      }),
    });
    expect(response.status).toBe(200);
    expect(resetDemo).toHaveBeenCalledOnce();
    expect(await response.json()).toEqual({ ok: true });
  });

  it("rejects cross-origin reset before mutation", async () => {
    const resetDemo = vi.fn(async () => {});
    const response = await executeDemoReset({
      runtime: resolveRuntimeConfig({
        nodeEnv: "test",
        runtimeMode: "demo",
        repositoryMode: "demo",
        publicAppUrl: "https://demo.circlecheck.test",
      }),
      requestOrigin: "https://attacker.test",
      repositories: () => ({
        ...createDemoRepositories(),
        resetDemo,
      }),
    });
    expect(response.status).toBe(403);
    expect(resetDemo).not.toHaveBeenCalled();
  });
});
