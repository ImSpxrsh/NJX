import React from "react";

export function LoadingIndicator({ label = "Loading..." }: { label?: string }) {
  return (
    <div
      role="status"
      aria-label={label}
      style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}
    >
      <span
        aria-hidden="true"
        style={{
          display: "inline-block",
          width: "1rem",
          height: "1rem",
          border: "3px solid #d1d5db",
          borderTopColor: "#374151",
          borderRadius: "50%",
          animation: "spin 1s linear infinite",
        }}
      ></span>
      <span>{label}</span>
    </div>
  );
}
