import "server-only";

export type LogEvent = {
  route: string;
  outcome: "success" | "failure" | "rate_limited";
  requestId?: string;
  checkId?: string;
  level?: "L0" | "L1" | "L2" | "L3";
  provider?: string;
  code?: string;
  durationMs?: number;
};

type LogSink = (event: LogEvent) => void;

const defaultSink: LogSink = (event) => {
  if (process.env.NODE_ENV === "test") return;
  if (process.env.CIRCLECHECK_STRUCTURED_LOG === "off") return;
  console.info(JSON.stringify({ kind: "circlecheck", ...event }));
};

let sink: LogSink = defaultSink;

export function logSecurityEvent(event: LogEvent): void {
  sink(event);
}

export function setLogSinkForTests(next: LogSink | null): void {
  sink = next ?? defaultSink;
}
