import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  setAuditSinkForTests,
  type AuditEvent,
} from "@/lib/observability/audit";
import { createDemoRepositories, resetDemo } from "@/lib/repository/demo-store";
import { buildEnrollmentNotification } from "./messages";
import { NotificationService } from "./service";
import type { NotificationProvider } from "./types";
import {
  deliverEnrollmentVerification,
  getInMemoryTransportForTests,
  resetNotificationForTests,
} from "./enrollment-notifier";

const HH = "55555555-5555-4555-8555-555555555555";
const LINK_TOKEN = "A".repeat(43);
const savedEnv = { ...process.env };

beforeEach(() => {
  process.env = { ...savedEnv };
  resetDemo();
  resetNotificationForTests();
});

afterEach(() => {
  setAuditSinkForTests(null);
  process.env = { ...savedEnv };
});

describe("enrollment notification delivery (CC-203)", () => {
  it("places the token only in the delivered message and never in logs", async () => {
    const events: AuditEvent[] = [];
    setAuditSinkForTests((event) => events.push(event));
    const transport = getInMemoryTransportForTests();

    const outcome = await deliverEnrollmentVerification({
      verificationId: "v-1",
      channel: "email",
      destination: "person@example.com",
      deliverySecret: { kind: "link", rawToken: LINK_TOKEN },
      appUrl: "https://app.test",
    });

    expect(outcome.status).toBe("DELIVERED");
    expect(transport.sent).toHaveLength(1);
    expect(transport.sent[0]!.body).toContain(`/enroll/verify/${LINK_TOKEN}`);
    // The token never reaches the audit log.
    expect(JSON.stringify(events)).not.toContain(LINK_TOKEN);
  });

  it("is idempotent for a duplicate job (single send)", async () => {
    const transport = getInMemoryTransportForTests();
    const args = {
      verificationId: "v-dup",
      channel: "email" as const,
      destination: "person@example.com",
      deliverySecret: { kind: "link" as const, rawToken: LINK_TOKEN },
      appUrl: "https://app.test",
    };
    const a = await deliverEnrollmentVerification(args);
    const b = await deliverEnrollmentVerification(args);
    expect(b).toEqual(a);
    expect(transport.sent).toHaveLength(1);
  });

  it("delivery success does not verify the destination", async () => {
    const repo = createDemoRepositories().enrollmentVerifications;
    const contact = await repo.createContact({
      householdId: HH,
      displayName: "Trusted",
      channel: "email",
      destination: "person@example.com",
    });
    if (!contact.ok) throw new Error("setup");
    const started = await repo.start({
      householdId: HH,
      trustedContactId: contact.contact.id,
    });
    if (!started.ok) throw new Error("start");

    const outcome = await deliverEnrollmentVerification({
      verificationId: started.verificationId,
      channel: started.channel,
      destination: "person@example.com",
      deliverySecret: started.deliverySecret,
      appUrl: "https://app.test",
    });
    expect(outcome.status).toBe("DELIVERED");
    // DELIVERED is not VERIFIED: the destination stays unverified until the
    // contact actually consumes the secret.
    expect(
      (await repo.getStatus(contact.contact.id))?.destinationVerified,
    ).toBe(false);
  });

  it("delivery failure leaves the destination unverified with manual guidance", async () => {
    const repo = createDemoRepositories().enrollmentVerifications;
    const contact = await repo.createContact({
      householdId: HH,
      displayName: "Trusted",
      channel: "email",
      destination: "person@example.com",
    });
    if (!contact.ok) throw new Error("setup");
    const started = await repo.start({
      householdId: HH,
      trustedContactId: contact.contact.id,
    });
    if (!started.ok) throw new Error("start");

    const failing: NotificationProvider = {
      channel: "email",
      async send() {
        return {
          status: "FAILED",
          errorCategory: "transport_error",
          retryable: false,
        };
      },
    };
    const service = new NotificationService({ email: failing });
    const message = buildEnrollmentNotification({
      channel: "email",
      to: "person@example.com",
      verifyUrl: `https://app.test/enroll/verify/${LINK_TOKEN}`,
    });
    const outcome = await service.deliver(message, {
      idempotencyKey: started.verificationId,
    });

    expect(outcome.status).toBe("FAILED");
    if (outcome.status === "FAILED") {
      expect(outcome.manualCallbackGuidance.length).toBeGreaterThan(0);
    }
    expect(
      (await repo.getStatus(contact.contact.id))?.destinationVerified,
    ).toBe(false);
  });
});
