import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  resolveRuntimeConfig,
  getRuntimeConfig,
  resetRuntimeConfigForTests,
} from "./runtime-config";

const env = process.env as Record<string, string | undefined>;
let savedRuntimeMode: string | undefined;
let savedRepoMode: string | undefined;

beforeEach(() => {
  savedRuntimeMode = env.CIRCLECHECK_RUNTIME_MODE;
  savedRepoMode = env.CIRCLECHECK_REPOSITORY_MODE;
  resetRuntimeConfigForTests();
});

afterEach(() => {
  resetRuntimeConfigForTests();
  if (savedRuntimeMode === undefined) delete env.CIRCLECHECK_RUNTIME_MODE;
  else env.CIRCLECHECK_RUNTIME_MODE = savedRuntimeMode;
  if (savedRepoMode === undefined) delete env.CIRCLECHECK_REPOSITORY_MODE;
  else env.CIRCLECHECK_REPOSITORY_MODE = savedRepoMode;
});

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

describe("getRuntimeConfig — caching and test isolation", () => {
  it("returns the same object on repeated calls", () => {
    env.CIRCLECHECK_RUNTIME_MODE = "test";
    env.CIRCLECHECK_REPOSITORY_MODE = "supabase";
    expect(getRuntimeConfig()).toBe(getRuntimeConfig());
  });

  it("resetRuntimeConfigForTests allows fresh resolution after env change", () => {
    env.CIRCLECHECK_RUNTIME_MODE = "test";
    env.CIRCLECHECK_REPOSITORY_MODE = "supabase";
    const first = getRuntimeConfig();
    expect(first.isDemo).toBe(false);

    resetRuntimeConfigForTests();
    env.CIRCLECHECK_RUNTIME_MODE = "demo";
    env.CIRCLECHECK_REPOSITORY_MODE = "demo";
    const second = getRuntimeConfig();
    expect(second.isDemo).toBe(true);
    expect(second).not.toBe(first);
  });
});
