import "server-only";
import type { CircleCheckRepositories } from "@/lib/repository/contracts";
import type { RuntimeConfig } from "@/lib/runtime-config";

type DemoResetDependencies = {
  runtime: RuntimeConfig;
  requestOrigin: string | null;
  repositories: () => CircleCheckRepositories;
};

export async function executeDemoReset({
  runtime,
  requestOrigin,
  repositories,
}: DemoResetDependencies): Promise<Response> {
  // This check must remain before repository construction or mutation.
  if (!runtime.allowDemoReset) {
    return Response.json({ error: "Not found." }, { status: 404 });
  }
  if (!runtime.publicAppUrl || requestOrigin !== runtime.publicAppUrl) {
    return Response.json({ error: "Request unavailable." }, { status: 403 });
  }
  const reset = repositories().resetDemo;
  if (!reset) {
    return Response.json({ error: "Not found." }, { status: 404 });
  }
  await reset();
  return Response.json({ ok: true });
}
