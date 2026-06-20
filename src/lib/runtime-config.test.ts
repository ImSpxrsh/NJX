import { describe, expect, it } from "vitest";
import { resolveRuntimeConfig } from "./runtime-config";

describe("runtime configuration", () => {
  it.each([
    [undefined, "production"],
    ["", "production"],
    ["false", "production"],
    ["False", "production"],
    ["FALSE", "production"],
    ["0", "production"],
    ["1", "production"],
    ["yes", "production"],
    ["no", "production"],
    ["off", "production"],
    ["on", "production"],
    ["DEMO", "production"],
    ["Demo", "production"],
    [" demo ", "production"],
    ["random", "production"],
  ])("does not enable demo for runtime value %s", (runtimeMode, nodeEnv) => {
    if (runtimeMode === undefined || runtimeMode === "") {
      expect(
        resolveRuntimeConfig({
          nodeEnv,
          runtimeMode,
          repositoryMode: "supabase",
        }).isDemo,
      ).toBe(false);
      return;
    }
    expect(() =>
      resolveRuntimeConfig({
        nodeEnv,
        runtimeMode,
        repositoryMode: "supabase",
      }),
    ).toThrow();
  });

  it("keeps normal development and test non-demo by default", () => {
    expect(
      resolveRuntimeConfig({
        nodeEnv: "development",
        repositoryMode: "supabase",
      }),
    ).toMatchObject({ mode: "development", isDemo: false });
    expect(
      resolveRuntimeConfig({
        nodeEnv: "test",
        repositoryMode: "supabase",
      }),
    ).toMatchObject({ mode: "test", isDemo: false });
  });

  it("enables demo only with the exact explicit value", () => {
    expect(
      resolveRuntimeConfig({
        nodeEnv: "development",
        runtimeMode: "demo",
        repositoryMode: "demo",
      }),
    ).toMatchObject({
      mode: "demo",
      isDemo: true,
      allowDemoReset: true,
    });
  });

  it("rejects production plus demo without a separate deployment marker", () => {
    expect(() =>
      resolveRuntimeConfig({
        nodeEnv: "production",
        runtimeMode: "demo",
        repositoryMode: "demo",
      }),
    ).toThrow("Demo runtime is forbidden");
  });

  it("allows an intentionally marked production-built demo deployment", () => {
    expect(
      resolveRuntimeConfig({
        nodeEnv: "production",
        runtimeMode: "demo",
        demoDeployment: "true",
        repositoryMode: "demo",
        publicAppUrl: "https://demo.circlecheck.test",
      }),
    ).toMatchObject({ isDemo: true, isProduction: false });
  });

  it("rejects contradictory repository configuration", () => {
    expect(() =>
      resolveRuntimeConfig({
        nodeEnv: "development",
        runtimeMode: "demo",
        repositoryMode: "supabase",
      }),
    ).toThrow("requires the demo repository");
    expect(() =>
      resolveRuntimeConfig({
        nodeEnv: "development",
        runtimeMode: "development",
        repositoryMode: "demo",
      }),
    ).toThrow("cannot run outside explicit demo runtime");
  });

  it("ignores ordinary client-controlled activation concepts", () => {
    const clientControlledNoise = {
      query: "?demo=true",
      headers: { "x-demo-mode": "true" },
      cookies: "demo=true",
      localStorage: { demo: "true" },
    };
    expect(
      resolveRuntimeConfig({
        nodeEnv: "development",
        repositoryMode: "supabase",
        ...clientControlledNoise,
      } as Parameters<typeof resolveRuntimeConfig>[0]),
    ).toMatchObject({ isDemo: false, allowDemoReset: false });
  });
});
