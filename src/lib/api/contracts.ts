import { z } from "zod";
import type { CheckStatusResponse } from "@/types/api";

// Consistent error envelope for all API routes.
export const apiErrorSchema = z
  .object({
    error: z.string(),
  })
  .strict();

export type ApiError = z.infer<typeof apiErrorSchema>;

// Signal names and their public projection.
const signalNameSchema = z.enum([
  "urgency",
  "secrecy",
  "payment",
  "credentials",
  "changed_contact",
]);

const publicEvidenceSignalSchema = z
  .object({
    name: signalNameSchema,
    score: z.number().min(0).max(1),
    present: z.boolean(),
    explanation: z.string(),
  })
  .strict();

// Zod v4 requires explicit key schema as first arg to z.record().
const signalsSchema = z.record(signalNameSchema, publicEvidenceSignalSchema);

export const checkStatusResponseSchema = z
  .object({
    checkId: z.string().uuid(),
    state: z.enum([
      "RECEIVED",
      "PAUSED",
      "PENDING",
      "VERIFIED",
      "DENIED",
      "EXPIRED",
    ]),
    level: z.enum(["L0", "L1", "L2", "L3"]),
    summary: z.string(),
    requestedAction: z.string().nullable(),
    policyReasons: z.array(z.string()),
    contactResponseStatus: z.string(),
    expiresAt: z.string().datetime({ offset: true }).nullable(),
    statusSource: z.enum([
      "POLICY_ENGINE",
      "ENROLLED_CONTACT",
      "NO_RESPONSE",
      "SYSTEM_EXPIRY",
    ]),
    signals: signalsSchema,
  })
  .strict();

// Static structural check: schema must match the TypeScript type.
checkStatusResponseSchema satisfies z.ZodType<CheckStatusResponse>;

// Validate a raw object as a check-status response. Throws ZodError if invalid.
export function parseCheckStatusResponse(raw: unknown): CheckStatusResponse {
  return checkStatusResponseSchema.parse(raw);
}
