import "server-only";
import { z } from "zod";

export type RuntimeMode = "production" | "development" | "test" | "demo";

export type RuntimeConfig = {
  mode: RuntimeMode;
  isProduction: boolean;
  isDemo: boolean;
  allowDemoReset: boolean;
  repositoryMode: "demo" | "supabase";
  publicAppUrl: string | null;
};

export type RuntimeEnvironment = {
  nodeEnv?: string;
  vercelEnv?: string;
  runtimeMode?: string;
  demoDeployment?: string;
  repositoryMode?: string;
  publicAppUrl?: string;
};

const explicitModeSchema = z.enum([
  "production",
  "development",
  "test",
  "demo",
]);
const repositoryModeSchema = z.enum(["demo", "supabase"]);

function defaultMode(
  environment: RuntimeEnvironment,
): Exclude<RuntimeMode, "demo"> {
  if (
    environment.nodeEnv === "production" ||
    environment.vercelEnv === "production"
  ) {
    return "production";
  }
  if (environment.nodeEnv === "test") return "test";
  return "development";
}

/**
 * Runtime mode is a server-side security boundary. Request data, headers,
 * cookies, browser storage, and public environment variables are deliberately
 * absent from this resolver.
 */
export function resolveRuntimeConfig(
  environment: RuntimeEnvironment,
): RuntimeConfig {
  const rawMode = environment.runtimeMode;
  const mode =
    rawMode === undefined || rawMode === ""
      ? defaultMode(environment)
      : explicitModeSchema.parse(rawMode);
  const productionDeployment =
    environment.nodeEnv === "production" ||
    environment.vercelEnv === "production";
  const explicitDemoDeployment = environment.demoDeployment === "true";

  if (mode === "demo" && productionDeployment && !explicitDemoDeployment) {
    throw new Error(
      "Demo runtime is forbidden in a production deployment unless CIRCLECHECK_DEMO_DEPLOYMENT is exactly true.",
    );
  }
  if (
    environment.demoDeployment !== undefined &&
    environment.demoDeployment !== "" &&
    environment.demoDeployment !== "true" &&
    environment.demoDeployment !== "false"
  ) {
    throw new Error(
      "CIRCLECHECK_DEMO_DEPLOYMENT must be exactly true or false.",
    );
  }

  const isDemo = mode === "demo";
  const repositoryMode = repositoryModeSchema.parse(
    environment.repositoryMode ??
      (isDemo ? "demo" : productionDeployment ? "supabase" : "supabase"),
  );

  if (isDemo && repositoryMode !== "demo") {
    throw new Error("Demo runtime requires the demo repository.");
  }
  if (!isDemo && repositoryMode === "demo") {
    throw new Error(
      "The demo repository cannot run outside explicit demo runtime.",
    );
  }
  const publicAppUrl = environment.publicAppUrl
    ? z.string().url().parse(environment.publicAppUrl).replace(/\/$/, "")
    : isDemo && !productionDeployment
      ? "http://localhost:3000"
      : null;
  if (isDemo && !publicAppUrl) {
    throw new Error("Demo runtime requires PUBLIC_APP_URL.");
  }

  return {
    mode,
    isProduction: productionDeployment && !isDemo,
    isDemo,
    allowDemoReset: isDemo,
    repositoryMode,
    publicAppUrl,
  };
}

let cachedConfig: RuntimeConfig | undefined;

export function getRuntimeConfig(): RuntimeConfig {
  cachedConfig ??= resolveRuntimeConfig({
    nodeEnv: process.env.NODE_ENV,
    vercelEnv: process.env.VERCEL_ENV,
    runtimeMode: process.env.CIRCLECHECK_RUNTIME_MODE,
    demoDeployment: process.env.CIRCLECHECK_DEMO_DEPLOYMENT,
    repositoryMode: process.env.CIRCLECHECK_REPOSITORY_MODE,
    publicAppUrl: process.env.PUBLIC_APP_URL,
  });
  return cachedConfig;
}

export function resetRuntimeConfigForTests(): void {
  cachedConfig = undefined;
}
