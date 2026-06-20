/**
 * Provider-neutral notification contracts (CC-203).
 *
 * Business logic depends only on these types, never on a concrete provider, so
 * new providers can be added without changing the service layer.
 *
 * Delivery is not identity verification. A {@link DeliveryStatus} of "DELIVERED"
 * means a provider accepted the message — nothing more. It is never equal to
 * CONFIRMED or VERIFIED and must never influence trust state.
 */
export type NotificationChannel = "sms" | "email";

export type NotificationCategory = "enrollment_verification";

/**
 * The sanitized, provider-ready payload. It contains only what is required to
 * deliver: the destination and the safe message body (which, for the one
 * permitted case, carries a one-time link or code). It deliberately cannot hold
 * a household id, raw suspicious message, contact secret, challenge value, or
 * verification state — there are no fields for them.
 */
export type OutboundNotification = {
  channel: NotificationChannel;
  category: NotificationCategory;
  /** Destination — the only personal data a notification may contain. */
  to: string;
  /** Email subject (email channel only). */
  subject?: string;
  /** Sanitized body. The one-time link/code is the only secret-bearing content. */
  body: string;
};

export type DeliveryStatus = "DELIVERED" | "FAILED";

/** Coarse, enumerated error categories only — never raw provider error text. */
export type DeliveryErrorCategory =
  | "timeout"
  | "rejected"
  | "transport_error"
  | "unknown";

export type ProviderResult = {
  status: DeliveryStatus;
  providerMessageId?: string;
  errorCategory?: DeliveryErrorCategory;
  retryable: boolean;
};

export interface NotificationProvider {
  readonly channel: NotificationChannel;
  send(message: OutboundNotification): Promise<ProviderResult>;
}

/**
 * Final outcome of a delivery attempt sequence. It carries no token, no
 * destination, and no trust state. A failure always includes plain manual
 * callback guidance.
 */
export type DeliveryOutcome =
  | {
      status: "DELIVERED";
      providerMessageId?: string;
      attempts: number;
    }
  | {
      status: "FAILED";
      attempts: number;
      manualCallbackGuidance: string;
    };
