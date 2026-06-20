import { describe, expect, it } from "vitest";
import { FixtureEvidenceExtractor } from "@/lib/evidence/fixture-extractor";
import { evaluatePolicy } from "@/lib/policy/evaluate-policy";
import { fixtures } from "@/fixtures/messages";
import { resolveRuntimeConfig } from "@/lib/runtime-config";
import {
  analyzeProductionResponseSchema,
  serializeAnalyzeResponse,
} from "./analyze-response";

function sensitiveKeys(value: unknown, path = ""): string[] {
  if (!value || typeof value !== "object") return [];
  return Object.entries(value).flatMap(([key, nested]) => {
    const current = path ? `${path}.${key}` : key;
    const matches =
      /token|secret|demoContactUrl|verificationUrl|verifyUrl|contactUrl|tokenHash|safePhrase/i.test(
        key,
      )
        ? [current]
        : [];
    return [...matches, ...sensitiveKeys(nested, current)];
  });
}

async function responseInput(text: string) {
  const extraction = await new FixtureEvidenceExtractor().extract({
    text,
    requestId: "analyze-response-test",
  });
  return {
    checkId: "00000000-0000-4000-8000-000000000010",
    state: (evaluatePolicy(extraction).verificationRequired
      ? "PENDING"
      : "PAUSED") as "PAUSED" | "PENDING",
    extraction,
    decision: evaluatePolicy(extraction),
  };
}

describe("analyze response serialization", () => {
  it.each([fixtures.ordinary, fixtures.giftCardEmergency])(
    "keeps production responses free of verification capabilities",
    async (text) => {
      const rawToken = "A".repeat(43);
      const result = serializeAnalyzeResponse(
        resolveRuntimeConfig({
          nodeEnv: "production",
          runtimeMode: "production",
          repositoryMode: "supabase",
          publicAppUrl: "https://circlecheck.test",
        }),
        {
          ...(await responseInput(text)),
          verification:
            text === fixtures.ordinary
              ? undefined
              : {
                  requestId: "00000000-0000-4000-8000-000000000020",
                  expiresAt: "2026-06-20T12:10:00.000Z",
                  rawToken,
                },
        },
      );

      expect(sensitiveKeys(result)).toEqual([]);
      expect(JSON.stringify(result)).not.toContain(rawToken);
      expect(JSON.stringify(result)).not.toContain("/verify/");
      expect(analyzeProductionResponseSchema.parse(result)).toEqual(result);
    },
  );

  it("returns a contact URL only through the explicit demo schema", async () => {
    const result = serializeAnalyzeResponse(
      resolveRuntimeConfig({
        nodeEnv: "development",
        runtimeMode: "demo",
        repositoryMode: "demo",
        publicAppUrl: "https://demo.circlecheck.test/",
      }),
      {
        ...(await responseInput(fixtures.giftCardEmergency)),
        verification: {
          requestId: "00000000-0000-4000-8000-000000000020",
          expiresAt: "2026-06-20T12:10:00.000Z",
          rawToken: "A".repeat(43),
        },
      },
    );
    expect(result.verification).toHaveProperty(
      "demoContactUrl",
      `https://demo.circlecheck.test/verify/${"A".repeat(43)}`,
    );
  });

  it("makes the production schema reject an accidental demo field", async () => {
    const input = await responseInput(fixtures.giftCardEmergency);
    expect(() =>
      analyzeProductionResponseSchema.parse({
        ...input,
        verification: {
          requestId: "00000000-0000-4000-8000-000000000020",
          expiresAt: "2026-06-20T12:10:00.000Z",
          demoContactUrl: "https://demo.test/verify/secret",
        },
      }),
    ).toThrow();
  });

  it("fails closed when demo delivery lacks a raw token", async () => {
    const input = await responseInput(fixtures.giftCardEmergency);
    expect(() =>
      serializeAnalyzeResponse(
        resolveRuntimeConfig({
          nodeEnv: "test",
          runtimeMode: "demo",
          repositoryMode: "demo",
        }),
        {
          ...input,
          verification: {
            requestId: "00000000-0000-4000-8000-000000000020",
            expiresAt: "2026-06-20T12:10:00.000Z",
          },
        },
      ),
    ).toThrow("Demo verification delivery is unavailable");
  });
});
