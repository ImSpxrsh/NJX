import { describe, expect, it } from "vitest";
import type { OutboundNotification } from "@/lib/notification/types";
import { createSmsProvider } from "./sms";
import { createEmailProvider } from "./email";

const smsMessage: OutboundNotification = {
  channel: "sms",
  category: "enrollment_verification",
  to: "+15551234567",
  body: "code 12345678",
};

const emailMessage: OutboundNotification = {
  channel: "email",
  category: "enrollment_verification",
  to: "person@example.com",
  subject: "Confirm",
  body: "link",
};

describe("SMS provider", () => {
  it("reports DELIVERED with the provider message id", async () => {
    const provider = createSmsProvider(async () => ({ id: "m-1" }));
    expect(await provider.send(smsMessage)).toEqual({
      status: "DELIVERED",
      providerMessageId: "m-1",
      retryable: false,
    });
  });

  it("classifies a thrown error as a retryable transport error", async () => {
    const provider = createSmsProvider(async () => {
      throw new Error("boom");
    });
    expect(await provider.send(smsMessage)).toMatchObject({
      status: "FAILED",
      errorCategory: "transport_error",
      retryable: true,
    });
  });

  it("classifies a tagged rejection as non-retryable", async () => {
    const provider = createSmsProvider(async () => {
      throw Object.assign(new Error("bad number"), { category: "rejected" });
    });
    expect(await provider.send(smsMessage)).toMatchObject({
      status: "FAILED",
      errorCategory: "rejected",
      retryable: false,
    });
  });

  it("times out a hanging transport", async () => {
    const provider = createSmsProvider(() => new Promise(() => {}), {
      timeoutMs: 5,
    });
    expect(await provider.send(smsMessage)).toEqual({
      status: "FAILED",
      errorCategory: "timeout",
      retryable: true,
    });
  });
});

describe("email provider", () => {
  it("reports DELIVERED on success", async () => {
    const provider = createEmailProvider(async () => ({ id: "e-1" }));
    expect(await provider.send(emailMessage)).toMatchObject({
      status: "DELIVERED",
      providerMessageId: "e-1",
    });
  });

  it("times out a hanging transport", async () => {
    const provider = createEmailProvider(() => new Promise(() => {}), {
      timeoutMs: 5,
    });
    expect(await provider.send(emailMessage)).toMatchObject({
      status: "FAILED",
      errorCategory: "timeout",
      retryable: true,
    });
  });
});
