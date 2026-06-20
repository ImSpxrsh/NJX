import { getRepositories } from "@/lib/repository/factory";
import { getRuntimeConfig } from "@/lib/runtime-config";
import { executeDemoReset } from "@/lib/demo/reset";

export async function POST(request: Request) {
  return executeDemoReset({
    runtime: getRuntimeConfig(),
    requestOrigin: request.headers.get("origin"),
    repositories: getRepositories,
  });
}
