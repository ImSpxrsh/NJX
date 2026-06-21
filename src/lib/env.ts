import "server-only";
import { z } from "zod";

const envSchema = z
  .object({
    CIRCLECHECK_REPOSITORY_MODE: z.enum(["demo", "supabase"]),
    NODE_ENV: z.enum(["development", "production", "test"]).optional(),
    PUBLIC_APP_URL: z.string().url().optional(),
    // Supabase — required when mode=supabase, ignored in demo
    SUPABASE_URL: z.string().url().optional(),
    SUPABASE_SERVICE_ROLE_KEY: z.string().optional(),
    NEXT_PUBLIC_SUPABASE_URL: z.string().url().optional(),
    NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().optional(),
    // Optional config
    VERIFICATION_TOKEN_TTL_MINUTES: z.coerce
      .number()
      .int()
      .positive()
      .default(10),
    EVIDENCE_EXTRACTOR_MODE: z.enum(["fixture", "llm"]).default("fixture"),
  })
  .superRefine((env, ctx) => {
    // When supabase mode, require Supabase credentials
    if (env.CIRCLECHECK_REPOSITORY_MODE === "supabase") {
      if (!env.SUPABASE_URL) {
        ctx.addIssue({
          code: "custom",
          message:
            "SUPABASE_URL required when CIRCLECHECK_REPOSITORY_MODE=supabase",
          path: ["SUPABASE_URL"],
        });
      }
      if (!env.SUPABASE_SERVICE_ROLE_KEY) {
        ctx.addIssue({
          code: "custom",
          message:
            "SUPABASE_SERVICE_ROLE_KEY required when CIRCLECHECK_REPOSITORY_MODE=supabase",
          path: ["SUPABASE_SERVICE_ROLE_KEY"],
        });
      }
    }
    // Refuse to expose service-role key as public var
    const publicServiceKey = process.env.NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY;
    if (publicServiceKey) {
      ctx.addIssue({
        code: "custom",
        message:
          "NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY must never be set — this would expose the service role key to the browser",
        path: [],
      });
    }
  });

function parseEnv() {
  const result = envSchema.safeParse(process.env);
  if (!result.success) {
    // Log variable names and error messages, never values
    const errors = result.error.issues
      .map((i) => `  ${i.path.join(".") || "(root)"}: ${i.message}`)
      .join("\n");
    throw new Error(
      `[env] Invalid environment configuration:\n${errors}\n\nDo not start the server with invalid configuration.`,
    );
  }
  return result.data;
}

export const env = parseEnv();
