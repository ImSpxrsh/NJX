import React from "react";

export function ErrorMessage({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <p
      role="alert"
      style={{
        color: "#991b1b",
        fontWeight: 600,
        padding: "0.75rem",
        border: "2px solid #f87171",
        borderRadius: "0.375rem",
        background: "#fee2e2",
      }}
    >
      {message}
    </p>
  );
}
