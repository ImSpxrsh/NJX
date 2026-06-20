import { z } from "zod";
import { evidenceExtractionSchema } from "@/lib/evidence/schema";
import type { PolicyDecision } from "@/types/domain";
import type {
  AnalyzeDemoResponse,
  AnalyzeProductionResponse,
} from "@/types/api";
import type { CreatedVerification } from "@/lib/repository/contracts";
import type { RuntimeConfig } from "@/lib/runtime-config";

const policyDecisionSchema: z.ZodType<PolicyDecision> = z
  .object({
    level: z.enum(["L0", "L1", "L2", "L3"]),
    verificationRequired: z.boolean(),
    reasons: z.array(z.string().trim().max(500)).max(20),
    requiredAction: z.enum([
      "NONE",
      "KNOWN_NUMBER_CALLBACK",
      "TRUSTED_CONTACT_CONFIRMATION",
      "MANDATORY_HOLD_AND_VERIFY",
    ]),
    policyScore: z.number().min(0).max(1),
  })
  .strict();

const responseBase = {
  checkId: z.string().uuid(),
  state: z.enum(["PAUSED", "PENDING"]),
  extraction: evidenceExtractionSchema,
  decision: policyDecisionSchema,
};

export const analyzeProductionResponseSchema = z
  .object({
    ...responseBase,
    verification: z
      .object({
        requestId: z.string().uuid(),
        expiresAt: z.string().datetime({ offset: true }),
      })
      .strict()
      .optional(),
  })
  .strict();

export const analyzeDemoResponseSchema = z
  .object({
    ...responseBase,
    verification: z
      .object({
        requestId: z.string().uuid(),
        expiresAt: z.string().datetime({ offset: true }),
        demoContactUrl: z.string().url(),
      })
      .strict()
      .optional(),
  })
  .strict();

type AnalyzeResponseInput = {
  checkId: string;
  state: "PAUSED" | "PENDING";
  extraction: z.infer<typeof evidenceExtractionSchema>;
  decision: PolicyDecision;
  verification?: CreatedVerification;
};

export function serializeAnalyzeResponse(
  runtime: RuntimeConfig,
  input: AnalyzeResponseInput,
): AnalyzeProductionResponse | AnalyzeDemoResponse {
  const safeBase = {
    checkId: input.checkId,
    state: input.state,
    extraction: input.extraction,
    decision: input.decision,
  };

  if (runtime.isDemo) {
    if (!input.verification) {
      return analyzeDemoResponseSchema.parse(safeBase);
    }
    if (!input.verification.rawToken || !runtime.publicAppUrl) {
      throw new Error("Demo verification delivery is unavailable.");
    }
    return analyzeDemoResponseSchema.parse({
      ...safeBase,
      verification: {
        requestId: input.verification.requestId,
        expiresAt: input.verification.expiresAt,
        demoContactUrl: `${runtime.publicAppUrl}/verify/${input.verification.rawToken}`,
      },
    });
  }

  return analyzeProductionResponseSchema.parse({
    ...safeBase,
    ...(input.verification
      ? {
          verification: {
            requestId: input.verification.requestId,
            expiresAt: input.verification.expiresAt,
          },
        }
      : {}),
  });
}
