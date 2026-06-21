import type { ButtonHTMLAttributes } from "react";

export function LargeActionButton({
  "aria-label": ariaLabel,
  children,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      aria-label={
        ariaLabel ?? (typeof children === "string" ? children : undefined)
      }
      {...props}
    >
      {children}
    </button>
  );
}
