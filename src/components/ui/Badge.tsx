import React from "react";

type Level = "L0" | "L1" | "L2" | "L3";

const config: Record<Level, { label: string; style: React.CSSProperties }> = {
  L0: { label: "Low concern", style: { background: "#d1fae5", color: "#065f46", border: "2px solid #6ee7b7" } },
  L1: { label: "Callback advised", style: { background: "#fef3c7", color: "#92400e", border: "2px solid #fcd34d" } },
  L2: { label: "Verify before acting", style: { background: "#fed7aa", color: "#92400e", border: "2px solid #fb923c" } },
  L3: { label: "Stop — do not act", style: { background: "#fee2e2", color: "#991b1b", border: "2px solid #f87171" } },
};

export function RiskBadge({ level }: { level: Level }) {
  return (
    <span
      role="status"
      style={{
        ...config[level].style,
        display: "inline-block",
        padding: "0.4rem 0.9rem",
        borderRadius: "0.375rem",
        fontWeight: 700,
        fontSize: "1rem",
        letterSpacing: "0.02em",
      }}
    >
      {level}: {config[level].label}
    </span>
  );
}
