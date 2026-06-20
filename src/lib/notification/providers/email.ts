import type {
  NotificationProvider,
  OutboundNotification,
  ProviderResult,
} from "@/lib/notification/types";
import type { EmailTransport } from "@/lib/notification/transport";
import { classifyError, TIMEOUT, withTimeout } from "./provider-util";

const DEFAULT_TIMEOUT_MS = 10_000;

export function createEmailProvider(
  transport: EmailTransport,
  options: { timeoutMs?: number } = {},
): NotificationProvider {
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  return {
    channel: "email",
    async send(message: OutboundNotification): Promise<ProviderResult> {
      try {
        const result = await withTimeout(
          transport(message.to, message.subject ?? "", message.body),
          timeoutMs,
        );
        if (result === TIMEOUT) {
          return {
            status: "FAILED",
            errorCategory: "timeout",
            retryable: true,
          };
        }
        return {
          status: "DELIVERED",
          providerMessageId: result.id,
          retryable: false,
        };
      } catch (error) {
        return classifyError(error);
      }
    },
  };
}
