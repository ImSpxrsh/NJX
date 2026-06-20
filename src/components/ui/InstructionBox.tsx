import React from "react";

type Severity = "warning" | "info" | "success";

const severityConfig: Record<
  Severity,
  { background: string; border: string; color: string; prefix: string }
> = {
  warning: {
    background: "#fff8e8",
    border: "2px solid #fcd34d",
    color: "#7a4e00",
    prefix: "Warning:",
  },
  info: {
    background: "#eef8fa",
    border: "2px solid #176b87",
    color: "#173b57",
    prefix: "Note:",
  },
  success: {
    background: "#d1fae5",
    border: "2px solid #6ee7b7",
    color: "#065f46",
    prefix: "Done:",
  },
};

export function InstructionBox({
  children,
  severity = "info",
  heading,
}: {
  children: React.ReactNode;
  severity?: Severity;
  heading?: string;
}) {
  const cfg = severityConfig[severity];
  return (
    <div
      style={{
        background: cfg.background,
        border: cfg.border,
        borderRadius: "0.5rem",
        padding: "1rem 1.25rem",
        color: cfg.color,
      }}
    >
      {heading && (
        <p
          style={{
            margin: "0 0 0.5rem",
            fontWeight: 800,
            fontSize: "1rem",
          }}
        >
          <span aria-hidden="true">{cfg.prefix} </span>
          {heading}
        </p>
      )}
      <div>{children}</div>
    </div>
  );
}
