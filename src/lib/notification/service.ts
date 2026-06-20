import { recordAuditEvent } from "@/lib/observability/audit";
import { MANUAL_CALLBACK_GUIDANCE } from "./messages";
import type {
  DeliveryOutcome,
  NotificationChannel,
  NotificationProvider,
  OutboundNotification,
} from "./types";

export type DeliverOptions = {
  /**
   * Stable key for one logical delivery (e.g. the enrollment verification id).
   * Repeated calls with the same key return the first outcome and never re-send,
   * so a duplicate job is idempotent and cannot trigger a second delivery.
   */
  idempotencyKey: string;
  requestId?: string;
};

export type NotificationServiceOptions = {
  maxAttempts?: number;
  baseBackoffMs?: number;
  /** Injectable so tests do not wait on real backoff delays. */
  sleep?: (ms: number) => Promise<void>;
};

const defaultSleep = (ms: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, ms));

/**
 * Provider-neutral notification service (CC-203).
 *
 * It only delivers. It has no access to check state or enrollment state, so a
 * provider success can never affect a verification outcome: DELIVERED is not
 * CONFIRMED and is not VERIFIED. A delivery failure returns manual callback
 * guidance and changes nothing.
 */
export class NotificationService {
  private readonly providers: Partial<
    Record<NotificationChannel, NotificationProvider>
  >;
  private readonly maxAttempts: number;
  private readonly baseBackoffMs: number;
  private readonly sleep: (ms: number) => Promise<void>;
  private readonly outcomes = new Map<string, DeliveryOutcome>();

  constructor(
    providers: Partial<Record<NotificationChannel, NotificationProvider>>,
    options: NotificationServiceOptions = {},
  ) {
    this.providers = providers;
    this.maxAttempts = Math.max(1, options.maxAttempts ?? 3);
    this.baseBackoffMs = Math.max(0, options.baseBackoffMs ?? 500);
    this.sleep = options.sleep ?? defaultSleep;
  }

  async deliver(
    message: OutboundNotification,
    options: DeliverOptions,
  ): Promise<DeliveryOutcome> {
    const cached = this.outcomes.get(options.idempotencyKey);
    if (cached) {
      recordAuditEvent({
        event: "notification.deliver",
        outcome: "success",
        requestId: options.requestId,
        channel: message.channel,
        code: "deduplicated",
      });
      return cached;
    }

    const provider = this.providers[message.channel];
    if (!provider) {
      return this.fail(message, options, 0, "no_provider");
    }

    let attempts = 0;
    for (let attempt = 1; attempt <= this.maxAttempts; attempt += 1) {
      attempts = attempt;
      const result = await provider.send(message);
      if (result.status === "DELIVERED") {
        const outcome: DeliveryOutcome = {
          status: "DELIVERED",
          providerMessageId: result.providerMessageId,
          attempts,
        };
        this.outcomes.set(options.idempotencyKey, outcome);
        recordAuditEvent({
          event: "notification.deliver",
          outcome: "success",
          requestId: options.requestId,
          channel: message.channel,
          attemptCount: attempts,
        });
        return outcome;
      }
      recordAuditEvent({
        event: "notification.deliver",
        outcome: "failure",
        requestId: options.requestId,
        channel: message.channel,
        code: result.errorCategory ?? "unknown",
        attemptCount: attempts,
      });
      if (!result.retryable || attempt === this.maxAttempts) break;
      // Bounded exponential backoff: base * 2^(attempt-1).
      await this.sleep(this.baseBackoffMs * 2 ** (attempt - 1));
    }
    return this.fail(message, options, attempts, "exhausted");
  }

  /** Test seam: clear idempotency memory. */
  resetForTests(): void {
    this.outcomes.clear();
  }

  private fail(
    message: OutboundNotification,
    options: DeliverOptions,
    attempts: number,
    code: string,
  ): DeliveryOutcome {
    const outcome: DeliveryOutcome = {
      status: "FAILED",
      attempts,
      manualCallbackGuidance: MANUAL_CALLBACK_GUIDANCE,
    };
    this.outcomes.set(options.idempotencyKey, outcome);
    recordAuditEvent({
      event: "notification.deliver",
      outcome: "failure",
      requestId: options.requestId,
      channel: message.channel,
      code,
      attemptCount: attempts,
    });
    return outcome;
  }
}
