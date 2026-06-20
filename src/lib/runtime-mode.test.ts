import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  getRuntimeConfig,
  resetRuntimeConfigForTests,
} from "./runtime-mode";

// Cast process.env to allow mutation of NODE_ENV in tests.
const env = process.env as Record<string, string | undefined>;

let savedRepoMode: string | undefined;
let savedNodeEnv: string | undefined;

beforeEach(() => {
  resetRuntimeConfigForTests();
  savedRepoMode = env.CIRCLECHECK_REPOSITORY_MODE;
  savedNodeEnv = env.NODE_ENV;
});

afterEach(() => {
  resetRuntimeConfigForTests();
  if (savedRepoMode === undefined) delete env.CIRCLECHECK_REPOSITORY_MODE;
  else env.CIRCLECHECK_REPOSITORY_MODE = savedRepoMode;
  if (savedNodeEnv === undefined) delete env.NODE_ENV;
  else env.NODE_ENV = savedNodeEnv;
});

function setEnv(repoMode: string | undefined, nodeEnv: string | undefined) {
  if (repoMode === undefined) delete env.CIRCLECHECK_REPOSITORY_MODE;
  else env.CIRCLECHECK_REPOSITORY_MODE = repoMode;
  if (nodeEnv === undefined) delete env.NODE_ENV;
  else env.NODE_ENV = nodeEnv;
}

describe("getRuntimeConfig — demo disabled cases", () => {
  it.each([
    // [description, repoMode, nodeEnv]
    ["production NODE_ENV, missing repo mode", undefined, "production"],
    ["production NODE_ENV, false repo mode", "false", "production"],
    ["production NODE_ENV, empty repo mode", "", "production"],
    ["production NODE_ENV, supabase repo mode", "supabase", "production"],
    ["development NODE_ENV, missing repo mode", undefined, "development"],
    ["development NODE_ENV, supabase repo mode", "supabase", "development"],
    ["test NODE_ENV, missing repo mode", undefined, "test"],
    ["test NODE_ENV, supabase repo mode", "supabase", "test"],
    ["completely missing env", undefined, undefined],
  ])("%s", (_, repoMode, nodeEnv) => {
    setEnv(repoMode, nodeEnv);
    const config = getRuntimeConfig();
    expect(config.isDemo).toBe(false);
    expect(config.allowDemoReset).toBe(false);
  });
});

describe("getRuntimeConfig — false-like values never enable demo", () => {
  it.each([
    "0",
    "1",
    "false",
    "False",
    "FALSE",
    "true",
    "True",
    "TRUE",
    "yes",
    "no",
    "off",
    "on",
    "DEMO",
    "Demo",
    "  demo  ",
    "random-invalid-string",
    " ",
    "\t",
  ])("CIRCLECHECK_REPOSITORY_MODE=%j does not enable demo", (value) => {
    setEnv(value, "test");
    const config = getRuntimeConfig();
    expect(config.isDemo).toBe(false);
  });
});

describe("getRuntimeConfig — demo enabled cases", () => {
  it("development NODE_ENV + demo repo mode enables demo", () => {
    setEnv("demo", "development");
    const config = getRuntimeConfig();
    expect(config.isDemo).toBe(true);
    expect(config.mode).toBe("demo");
    expect(config.allowDemoReset).toBe(true);
    expect(config.isProduction).toBe(false);
  });

  it("test NODE_ENV + demo repo mode enables demo", () => {
    setEnv("demo", "test");
    const config = getRuntimeConfig();
    expect(config.isDemo).toBe(true);
    expect(config.mode).toBe("demo");
  });

  it("missing NODE_ENV + demo repo mode enables demo", () => {
    setEnv("demo", undefined);
    const config = getRuntimeConfig();
    expect(config.isDemo).toBe(true);
  });
});

describe("getRuntimeConfig — contradictory config fails closed", () => {
  it("NODE_ENV=production + CIRCLECHECK_REPOSITORY_MODE=demo resolves to production", () => {
    setEnv("demo", "production");
    const config = getRuntimeConfig();
    expect(config.isDemo).toBe(false);
    expect(config.isProduction).toBe(true);
    expect(config.mode).toBe("production");
    expect(config.allowDemoReset).toBe(false);
  });
});

describe("getRuntimeConfig — mode resolution", () => {
  it("production NODE_ENV resolves to production", () => {
    setEnv("supabase", "production");
    const config = getRuntimeConfig();
    expect(config.mode).toBe("production");
    expect(config.isProduction).toBe(true);
  });

  it("test NODE_ENV resolves to test", () => {
    setEnv(undefined, "test");
    const config = getRuntimeConfig();
    expect(config.mode).toBe("test");
    expect(config.isProduction).toBe(false);
    expect(config.isDemo).toBe(false);
  });

  it("development NODE_ENV resolves to development", () => {
    setEnv(undefined, "development");
    const config = getRuntimeConfig();
    expect(config.mode).toBe("development");
  });
});

describe("getRuntimeConfig — caching and test isolation", () => {
  it("returns the same object on repeated calls", () => {
    setEnv("demo", "test");
    expect(getRuntimeConfig()).toBe(getRuntimeConfig());
  });

  it("resetRuntimeConfigForTests allows fresh resolution", () => {
    setEnv("demo", "test");
    const first = getRuntimeConfig();
    expect(first.isDemo).toBe(true);

    resetRuntimeConfigForTests();
    setEnv("supabase", "production");
    const second = getRuntimeConfig();
    expect(second.isDemo).toBe(false);
    expect(second.isProduction).toBe(true);
  });
});
