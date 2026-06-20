import { randomUUID } from "node:crypto";

/**
 * Low-level transports actually talk to a provider API (Twilio, an email
 * service, etc.). They are injected into the channel adapters so the adapters —
 * and everything above them — stay provider-neutral.
 *
 * A production deployment injects a Twilio/email-backed transport. The in-memory
 * transport below is the default for the demo and tests; it records sends in
 * memory and performs no network I/O.
 */
export type SmsTransport = (
  to: string,
  body: string,
) => Promise<{ id: string }>;

export type EmailTransport = (
  to: string,
  subject: string,
  body: string,
) => Promise<{ id: string }>;

export type SentRecord = {
  channel: "sms" | "email";
  to: string;
  body: string;
  subject?: string;
  id: string;
};

export type InMemoryTransport = {
  sent: SentRecord[];
  sms: SmsTransport;
  email: EmailTransport;
};

export function createInMemoryTransport(): InMemoryTransport {
  const sent: SentRecord[] = [];
  return {
    sent,
    sms: async (to, body) => {
      const id = randomUUID();
      sent.push({ channel: "sms", to, body, id });
      return { id };
    },
    email: async (to, subject, body) => {
      const id = randomUUID();
      sent.push({ channel: "email", to, subject, body, id });
      return { id };
    },
  };
}
