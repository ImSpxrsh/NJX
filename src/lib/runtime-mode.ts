import "server-only";

// Runtime mode is a server-side security boundary.
// It must never be derived from client-supplied data — no query params, cookies,
// request headers, body fields, local storage, or browser state.
// Only explicit server-side environment configuration enables demo mode.

export type RuntimeMode = "production" | "development" | "test" | "demo";

export interface RuntimeConfig {
  mode: RuntimeMode;
  isProduction: boolean;
  isDemo: boolean;
  allowDemoReset: boolean;
}

// The single accepted value that activates demo mode.
// All of these must NOT activate demo mode:
//   undefined, "", "0", "false", "False", "FALSE", "no", "off",
//   "development", "production", "supabase", or any other string.
const DEMO_MODE_VALUE = "demo" as const;

function resolveRuntimeMode(): RuntimeMode {
  const repoMode = process.env.CIRCLECHECK_REPOSITORY_MODE;
  const nodeEnv = process.env.NODE_ENV;

  if (repoMode === DEMO_MODE_VALUE) {
    // Contradictory configuration: NODE_ENV=production + demo repository mode.
    // A production deployment must never accidentally serve demo data or expose
    // verification tokens. Fail closed by resolving to production mode.
    if (nodeEnv === "production") {
      console.error(
        "[runtime-mode] Contradictory configuration detected: " +
          "NODE_ENV=production with CIRCLECHECK_REPOSITORY_MODE=demo. " +
          "Resolving to production mode to fail closed. " +
          "Demo features are disabled.",
      );
      return "production";
    }
    return "demo";
  }

  if (nodeEnv === "test") return "test";
  if (nodeEnv === "development") return "development";
  return "production";
}

let _config: RuntimeConfig | undefined;

export function getRuntimeConfig(): RuntimeConfig {
  if (_config) return _config;
  const mode = resolveRuntimeMode();
  _config = {
    mode,
    isProduction: mode === "production",
    isDemo: mode === "demo",
    allowDemoReset: mode === "demo",
  };
  return _config;
}

/** Reset cached config between tests. Never call in production code. */
export function resetRuntimeConfigForTests(): void {
  _config = undefined;
}
