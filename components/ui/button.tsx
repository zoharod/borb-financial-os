import { ButtonHTMLAttributes } from "react";

type Variant = "primary" | "secondary" | "tertiary" | "danger";

const VARIANT_CLASSES: Record<Variant, string> = {
  primary: "bg-secondary text-on-secondary-container disabled:opacity-50",
  secondary:
    "bg-transparent border border-outline-variant text-on-surface hover:bg-surface-container",
  tertiary:
    "bg-transparent text-on-surface-variant hover:text-on-surface font-mono text-xs uppercase tracking-wider rounded-none",
  danger: "bg-transparent border border-error text-error hover:bg-error/10",
};

export function Button({
  variant = "primary",
  className = "",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }) {
  const shape = variant === "tertiary" ? "" : "rounded-full px-5 py-2";
  return (
    <button
      className={`${shape} font-medium transition-colors ${VARIANT_CLASSES[variant]} ${className}`}
      {...props}
    />
  );
}
