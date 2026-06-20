import React from "react";

export function StatusCard({
  children,
  role = "region",
  "aria-label": ariaLabel,
}: {
  children: React.ReactNode;
  role?: string;
  "aria-label"?: string;
}) {
  return (
    <div
      role={role}
      aria-label={ariaLabel}
      style={{
        border: "1px solid #c7cfda",
        borderRadius: "22px",
        padding: "clamp(1.25rem, 4vw, 2rem)",
        background: "#fffdf8",
        boxShadow: "0 16px 50px rgba(23, 59, 87, 0.08)",
        marginTop: "1rem",
      }}
    >
      {children}
    </div>
  );
}
