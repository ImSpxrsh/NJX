import { afterEach, describe, expect, it, vi } from "vitest";
import {
  setAuditSinkForTests,
  type AuditEvent,
} from "@/lib/observability/audit";
import { NotificationService } from "./service";
import { MANUAL_CALLBACK_GUIDANCE } from "./messages";
import type {
  NotificationProvider,
  OutboundNotification,
  ProviderResult,
} from "./types";

const message: OutboundNotification = {
  channel: "email",
  category: "enrollment_verification",
  to: "person@example.com",
  subject: "Confirm",
  body: "open https://app.test/enroll/verify/SECRET-TOKEN-VALUE",
};

function fakeProvider(results: ProviderResult[]) {
  const received: OutboundNotification[] = [];
  let calls = 0;
  const provider: NotificationProvider = {
    channel: "email",
    async send(msg) {
      received.push(msg);
      calls += 1;
      return results[Math.min(calls - 1, results.length - 1)]!;
    },
  };
  return {
    provider,
    received,
    get calls() {
      return calls;
    },
  };
}

const ok: ProviderResult = {
  status: "DELIVERED",
  providerMessageId: "p-1",
  retryable: false,
};
const retryableFail: ProviderResult = {
  status: "FAILED",
  errorCategory: "timeout",
  retryable: true,
};
const permanentFail: ProviderResult = {
  status: "FAILED",
  errorCategory: "rejected",
  retryable: false,
};

afterEach(() => setAuditSinkForTests(null));

describe("NotificationService", () => {
  it("retries with bounded backoff then succeeds", async () => {
    const f = fakeProvider([retryableFail, ok]);
    const sleep = vi.fn(async () => {});
    const service = new NotificationService(
      { email: f.provider },
      { maxAttempts: 3, baseBackoffMs: 100, sleep },
    );
    const outcome = await service.deliver(message, { idempotencyKey: "k1" });
    expect(outcome).toMatchObject({ status: "DELIVERED", attempts: 2 });
    expect(f.calls).toBe(2);
    expect(sleep).toHaveBeenCalledTimes(1);
    expect(sleep).toHaveBeenCalledWith(100);
  });

  it("stops immediately on a non-retryable failure", async () => {
    const f = fakeProvider([permanentFail]);
    const service = new NotificationService({ email: f.provider });
    const outcome = await service.deliver(message, { idempotencyKey: "k2" });
    expect(outcome).toEqual({
      status: "FAILED",
      attempts: 1,
      manualCallbackGuidance: MANUAL_CALLBACK_GUIDANCE,
    });
    expect(f.calls).toBe(1);
  });

  it("gives up after maxAttempts with manual callback guidance", async () => {
    const f = fakeProvider([retryableFail]);
    const service = new NotificationService(
      { email: f.provider },
      { maxAttempts: 2, sleep: async () => {} },
    );
    const outcome = await service.deliver(message, { idempotencyKey: "k3" });
    expect(outcome).toMatchObject({ status: "FAILED", attempts: 2 });
    if (outcome.status === "FAILED") {
      expect(outcome.manualCallbackGuidance).toBe(MANUAL_CALLBACK_GUIDANCE);
    }
    expect(f.calls).toBe(2);
  });

  it("is idempotent for a duplicate job and never re-sends", async () => {
    const f = fakeProvider([ok]);
    const service = new NotificationService({ email: f.provider });
    const first = await service.deliver(message, { idempotencyKey: "dup" });
    const second = await service.deliver(message, { idempotencyKey: "dup" });
    expect(second).toEqual(first);
    expect(f.calls).toBe(1);
  });

  it("passes only the sanitized payload to the provider", async () => {
    const f = fakeProvider([ok]);
    const service = new NotificationService({ email: f.provider });
    await service.deliver(message, { idempotencyKey: "k4" });
    // The provider receives exactly the OutboundNotification and nothing more
    // (no household id, no verification state, no raw message).
    expect(f.received[0]).toEqual(message);
    expect(Object.keys(f.received[0]!).sort()).toEqual([
      "body",
      "category",
      "channel",
      "subject",
      "to",
    ]);
  });

  it("never logs the token, destination, or message body", async () => {
    const events: AuditEvent[] = [];
    setAuditSinkForTests((event) => events.push(event));
    const f = fakeProvider([retryableFail, ok]);
    const service = new NotificationService(
      { email: f.provider },
      { sleep: async () => {} },
    );
    await service.deliver(message, { idempotencyKey: "k5", requestId: "r-1" });

    const serialized = JSON.stringify(events);
    expect(events.length).toBeGreaterThan(0);
    expect(serialized).not.toContain("SECRET-TOKEN-VALUE");
    expect(serialized).not.toContain("person@example.com");
    expect(serialized).not.toContain(message.body);
  });

  it("returns FAILED guidance when no provider is configured", async () => {
    const service = new NotificationService({});
    const outcome = await service.deliver(message, { idempotencyKey: "k6" });
    expect(outcome).toMatchObject({ status: "FAILED", attempts: 0 });
  });

  it("a delivered outcome carries no verification or trust state", async () => {
    const f = fakeProvider([ok]);
    const service = new NotificationService({ email: f.provider });
    const outcome = await service.deliver(message, { idempotencyKey: "k7" });
    // DELIVERED != CONFIRMED != VERIFIED: the outcome has no such fields.
    expect(outcome).not.toHaveProperty("verified");
    expect(outcome).not.toHaveProperty("confirmed");
    expect(outcome).not.toHaveProperty("state");
    expect(outcome.status).toBe("DELIVERED");
  });
});
