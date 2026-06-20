import React from "react";

type Variant = "primary" | "secondary" | "danger";

interface ActionButtonProps {
  children: React.ReactNode;
  onClick?: () => void;
  type?: "button" | "submit";
  disabled?: boolean;
  variant?: Variant;
}

const variantStyles: Record<Variant, React.CSSProperties> = {
  primary: {
    background: "#173b57",
    color: "white",
    border: "2px solid #173b57",
  },
  secondary: {
    background: "white",
    color: "#173b57",
    border: "2px solid #173b57",
  },
  danger: {
    background: "#8b1e2d",
    color: "white",
    border: "2px solid #8b1e2d",
  },
};

export function ActionButton({
  children,
  onClick,
  type = "button",
  disabled,
  variant = "primary",
}: ActionButtonProps) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      style={{
        ...variantStyles[variant],
        minHeight: "52px",
        fontSize: "1.1rem",
        fontWeight: 800,
        padding: "0.75rem 1.25rem",
        borderRadius: "14px",
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.6 : 1,
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        gap: "0.5rem",
      }}
    >
      {children}
    </button>
  );
}
