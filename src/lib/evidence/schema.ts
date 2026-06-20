import { z } from "zod";

const prohibitedKey = /^(safe|verified|legitimate|approved|fraudulent|trust)$/i;
const boundedText = z.string().trim().max(500);
const evidenceSpan = z.string().trim().max(160);

type SignalName =
  | "urgency"
  | "secrecy"
  | "payment"
  | "credentials"
  | "changed_contact";

const signalSchema = (name: SignalName) =>
  z
    .object({
      name: z.literal(name),
      score: z.number().min(0).max(1),
      present: z.boolean(),
      evidenceSpans: z.array(evidenceSpan).max(5),
      explanation: boundedText,
    })
    .strict();

const metadataSchema = z
  .object({
    promptVersion: z.string().trim().max(80),
    deterministicRuleVersion: z.string().trim().max(80),
    provider: z.string().trim().max(80),
    model: z.string().trim().max(120).nullable(),
    fallbackUsed: z.boolean(),
    ruleIds: z.array(z.string().trim().max(80)).max(30).optional(),
  })
  .strict();

export const evidenceExtractionSchema = z
  .object({
    schemaVersion: z.literal("1.0"),
    requestedAction: boundedText.nullable(),
    claimedIdentity: z.string().trim().max(120).nullable(),
    signals: z
      .object({
        urgency: signalSchema("urgency"),
        secrecy: signalSchema("secrecy"),
        payment: signalSchema("payment"),
        credentials: signalSchema("credentials"),
        changed_contact: signalSchema("changed_contact"),
      })
      .strict(),
    uncertainty: z.boolean(),
    plainLanguageSummary: boundedText,
    metadata: metadataSchema.optional(),
  })
  .strict()
  .superRefine((value, context) => {
    const inspect = (input: unknown, path: (string | number)[] = []) => {
      if (!input || typeof input !== "object") return;
      for (const [key, nested] of Object.entries(input)) {
        if (prohibitedKey.test(key)) {
          context.addIssue({
            code: "custom",
            message: `Prohibited trust field: ${key}`,
            path: [...path, key],
          });
        }
        inspect(nested, [...path, key]);
      }
    };
    inspect(value);
  });

export type ValidEvidenceExtraction = z.infer<typeof evidenceExtractionSchema>;
