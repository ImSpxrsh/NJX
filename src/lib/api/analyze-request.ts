import { z } from "zod";

export const analyzeRequestSchema = z
  .object({
    householdId: z.string().uuid(),
    message: z.string().trim().min(1).max(4_000),
    mode: z.enum(["fixture", "llm"]).optional(),
  })
  .strict();
