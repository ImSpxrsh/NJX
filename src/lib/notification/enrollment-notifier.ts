import "server-only";
import type { DeliverySecret } from "@/lib/repository/contracts";
import { buildEnrollmentNotification } from "./messages";
import { createEmailProvider } from "./providers/email";
import { createSmsProvider } from "./providers/sms";
import { NotificationService } from "./service";
import { createInMemoryTransport, type InMemoryTransport } from "./transport";
import type { DeliveryOutcome, NotificationChannel } from "./types";

function intEnv(name: string, fallback: number, min: number, max: number) {
  const parsed = Number(process.env[name]);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, Math.trunc(parsed)));
}

let singleton:
  | { service: NotificationService; transport: InMemoryTransport }
  | undefined;

/**
 * Default wiring uses the in-memory transport (no live provider credentials in
 * this repository). A production deployment injects Twilio/email transports here
 * without touching the service or callers.
 */
function getNotification() {
  if (!singleton) {
    const timeoutMs = intEnv("NOTIFICATION_TIMEOUT_MS", 10_000, 100, 60_000);
    const transport = createInMemoryTransport();
    const service = new NotificationService(
      {
        sms: createSmsProvider(transport.sms, { timeoutMs }),
        email: createEmailProvider(transport.email, { timeoutMs }),
      },
      {
        maxAttempts: intEnv("NOTIFICATION_MAX_ATTEMPTS", 3, 1, 10),
        baseBackoffMs: intEnv("NOTIFICATION_BASE_BACKOFF_MS", 500, 0, 60_000),
      },
    );
    singleton = { service, transport };
  }
  return singleton;
}

/**
 * Deliver an already-issued enrollment secret. This never creates a token, so
 * retries (same `verificationId`) cannot create multiple active tokens, and the
 * service deduplicates by `verificationId`. Delivery success or failure does not
 * change any verification state.
 */
export async function deliverEnrollmentVerification(input: {
  verificationId: string;
  channel: NotificationChannel;
  destination: string;
  deliverySecret: DeliverySecret;
  appUrl: string;
  requestId?: string;
}): Promise<DeliveryOutcome> {
  const message = buildEnrollmentNotification({
    channel: input.channel,
    to: input.destination,
    verifyUrl:
      input.deliverySecret.kind === "link"
        ? `${input.appUrl}/enroll/verify/${input.deliverySecret.rawToken}`
        : undefined,
    code:
      input.deliverySecret.kind === "code"
        ? input.deliverySecret.code
        : undefined,
  });
  return getNotification().service.deliver(message, {
    idempotencyKey: input.verificationId,
    requestId: input.requestId,
  });
}

export function resetNotificationForTests(): void {
  singleton = undefined;
}

export function getInMemoryTransportForTests(): InMemoryTransport {
  return getNotification().transport;
}
