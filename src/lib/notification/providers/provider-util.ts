import type {
  DeliveryErrorCategory,
  ProviderResult,
} from "@/lib/notification/types";

const TIMEOUT = Symbol("timeout");

/** Race a provider call against a timeout without leaking the timer. */
export async function withTimeout<T>(
  work: Promise<T>,
  timeoutMs: number,
): Promise<T | typeof TIMEOUT> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<typeof TIMEOUT>((resolve) => {
    timer = setTimeout(() => resolve(TIMEOUT), timeoutMs);
  });
  try {
    return await Promise.race([work, timeout]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

export { TIMEOUT };

/**
 * Map a transport outcome to a coarse {@link ProviderResult}. A thrown error may
 * carry an optional `category` to mark itself non-retryable (e.g. a permanent
 * rejection); otherwise it is treated as a retryable transport error.
 */
export function classifyError(error: unknown): ProviderResult {
  const category = readCategory(error);
  const retryable = category === "transport_error" || category === "timeout";
  return { status: "FAILED", errorCategory: category, retryable };
}

function readCategory(error: unknown): DeliveryErrorCategory {
  if (error && typeof error === "object" && "category" in error) {
    const value = (error as { category?: unknown }).category;
    if (
      value === "timeout" ||
      value === "rejected" ||
      value === "transport_error" ||
      value === "unknown"
    ) {
      return value;
    }
  }
  return "transport_error";
}
