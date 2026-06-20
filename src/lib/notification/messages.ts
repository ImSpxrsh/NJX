import type { NotificationChannel, OutboundNotification } from "./types";

/**
 * Shown to the senior whenever delivery fails. It preserves friction: it never
 * implies the request was confirmed and it directs the user to a number they
 * already know rather than anything from the suspicious message.
 */
export const MANUAL_CALLBACK_GUIDANCE =
  "We could not deliver the verification message. Do not act on the original " +
  "request yet. Reach your trusted contact using a phone number you already " +
  "know — never a number from the message.";

/**
 * Build the sanitized enrollment-verification notification. Content is limited to
 * a short, generic explanation plus the one-time link (email) or code (SMS). It
 * contains no household identifier, no contact identifier, no suspicious-message
 * content, and no verification state. The link carries only the token.
 */
export function buildEnrollmentNotification(input: {
  channel: NotificationChannel;
  to: string;
  verifyUrl?: string;
  code?: string;
}): OutboundNotification {
  if (input.channel === "email") {
    if (!input.verifyUrl) throw new Error("email enrollment requires a link");
    return {
      channel: "email",
      category: "enrollment_verification",
      to: input.to,
      subject: "Confirm your CircleCheck contact details",
      body:
        "Someone set up CircleCheck and listed this address as a trusted " +
        "contact. To confirm it, open this one-time link:\n\n" +
        `${input.verifyUrl}\n\n` +
        "If you were not expecting this, you can ignore this message.",
    };
  }
  if (!input.code) throw new Error("sms enrollment requires a code");
  return {
    channel: "sms",
    category: "enrollment_verification",
    to: input.to,
    body:
      `Your CircleCheck confirmation code is ${input.code}. ` +
      "It expires soon. If you were not expecting this, ignore it.",
  };
}
