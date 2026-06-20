import "server-only";
import type { CircleCheckRepositories } from "./contracts";
import { createDemoRepositories } from "./demo-store";

export type RepositoryMode = "demo" | "supabase";

type RepositoryProviders = {
  demo: () => CircleCheckRepositories;
  supabase?: () => CircleCheckRepositories;
};

export function resolveRepositoryMode(
  value: string | undefined,
): RepositoryMode {
  if (value === "demo" || value === "supabase") return value;
  throw new Error(
    "CIRCLECHECK_REPOSITORY_MODE must be explicitly set to demo or supabase.",
  );
}

export function createRepositories(
  mode: RepositoryMode,
  providers: RepositoryProviders,
): CircleCheckRepositories {
  if (mode === "demo") return providers.demo();
  if (!providers.supabase) {
    throw new Error(
      "Supabase repository mode was selected, but no Supabase repository implementation is configured.",
    );
  }
  return providers.supabase();
}

let repositories: CircleCheckRepositories | undefined;

export function getRepositories(): CircleCheckRepositories {
  if (repositories) return repositories;
  const mode = resolveRepositoryMode(process.env.CIRCLECHECK_REPOSITORY_MODE);
  repositories = createRepositories(mode, {
    demo: createDemoRepositories,
  });
  return repositories;
}

export function resetRepositoryFactoryForTests(): void {
  repositories = undefined;
}
