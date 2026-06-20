import type { AnalyzeResponse } from "@/types/api";
import type { CreatedVerification } from "./contracts";
import type { RepositoryMode } from "./factory";

export function toClientVerificationMetadata(
  mode: RepositoryMode,
  verification: CreatedVerification,
  appUrl: string,
): NonNullable<AnalyzeResponse["verification"]> {
  return {
    requestId: verification.requestId,
    expiresAt: verification.expiresAt,
    ...(mode === "demo" && verification.rawToken
      ? {
          demoContactUrl: `${appUrl}/verify/${verification.rawToken}`,
        }
      : {}),
  };
}
