import { describe, expect, it } from "vitest";
import {
  apiErrorSchema,
  checkStatusResponseSchema,
  parseCheckStatusResponse,
} from "./contracts";

const validSignals = {
  urgency: {
    name: "urgency",
    score: 0.9,
    present: true,
    explanation: "Time pressure detected.",
  },
  secrecy: {
    name: "secrecy",
    score: 0.0,
    present: false,
    explanation: "No secrecy indicators.",
  },
  payment: {
    name: "payment",
    score: 0.8,
    present: true,
    explanation: "Payment request detected.",
  },
  credentials: {
    name: "credentials",
    score: 0.0,
    present: false,
    explanation: "No credential requests.",
  },
  changed_contact: {
    name: "changed_contact",
    score: 0.0,
    present: false,
    explanation: "No contact change.",
  },
};

const validResponse = {
  checkId: "00000000-0000-4000-8000-000000000001",
  state: "PENDING" as const,
  level: "L2" as const,
  summary: "This message requests an urgent money transfer.",
  requestedAction: "TRUSTED_CONTACT_CONFIRMATION",
  policyReasons: ["High urgency score", "Payment signal present"],
  contactResponseStatus: "AWAITING_RESPONSE",
  expiresAt: "2026-07-10T21:00:00.000Z",
  statusSource: "POLICY_ENGINE" as const,
  signals: validSignals,
};

describe("checkStatusResponseSchema", () => {
  it("accepts a valid status response", () => {
    expect(checkStatusResponseSchema.parse(validResponse)).toEqual(
      validResponse,
    );
  });

  it("accepts null for expiresAt and requestedAction", () => {
    const parsed = checkStatusResponseSchema.parse({
      ...validResponse,
      expiresAt: null,
      requestedAction: null,
    });
    expect(parsed.expiresAt).toBeNull();
    expect(parsed.requestedAction).toBeNull();
  });

  it("rejects unknown state values", () => {
    expect(() =>
      checkStatusResponseSchema.parse({ ...validResponse, state: "UNKNOWN" }),
    ).toThrow();
  });

  it("rejects signal scores outside [0, 1]", () => {
    const badSignals = {
      ...validSignals,
      urgency: { ...validSignals.urgency, score: 1.5 },
    };
    expect(() =>
      checkStatusResponseSchema.parse({
        ...validResponse,
        signals: badSignals,
      }),
    ).toThrow();
  });

  it("rejects unknown signal names in the record", () => {
    const badSignals = {
      ...validSignals,
      unknown_signal: {
        name: "unknown_signal",
        score: 0.5,
        present: true,
        explanation: "x",
      },
    };
    expect(() =>
      checkStatusResponseSchema.parse({
        ...validResponse,
        signals: badSignals,
      }),
    ).toThrow();
  });

  it("rejects extra fields on the top-level object", () => {
    expect(() =>
      checkStatusResponseSchema.parse({ ...validResponse, rawToken: "secret" }),
    ).toThrow();
  });

  it("rejects missing required fields", () => {
    const { checkId: _omit, ...withoutId } = validResponse;
    expect(() => checkStatusResponseSchema.parse(withoutId)).toThrow();
  });

  it("rejects non-UUID checkId", () => {
    expect(() =>
      checkStatusResponseSchema.parse({
        ...validResponse,
        checkId: "not-a-uuid",
      }),
    ).toThrow();
  });
});

describe("parseCheckStatusResponse", () => {
  it("returns the parsed value for valid input", () => {
    const result = parseCheckStatusResponse(validResponse);
    expect(result.checkId).toBe(validResponse.checkId);
    expect(result.signals.urgency.score).toBe(0.9);
  });

  it("throws for invalid input", () => {
    expect(() => parseCheckStatusResponse({ wrong: "shape" })).toThrow();
  });
});

describe("apiErrorSchema", () => {
  it("accepts a valid error envelope", () => {
    expect(apiErrorSchema.parse({ error: "Something went wrong." })).toEqual({
      error: "Something went wrong.",
    });
  });

  it("rejects extra fields", () => {
    expect(() => apiErrorSchema.parse({ error: "fail", code: 400 })).toThrow();
  });

  it("rejects missing error field", () => {
    expect(() => apiErrorSchema.parse({})).toThrow();
  });
});
