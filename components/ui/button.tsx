import { ButtonHTMLAttributes } from "react";

type Variant = "primary" | "secondary" | "tertiary" | "danger";

const VARIANT_CLASSES: Record<Variant, string> = {
  primary:
    "bg-primary text-on-primary font-bold hover:brightness-110 glow-active disabled:opacity-50 disabled:hover:brightness-100",
  secondary:
    "bg-transparent border border-outline-variant/50 text-on-surface hover:bg-surface-container-high",
  tertiary:
    "bg-transparent text-on-surface-variant hover:text-on-surface text-xs uppercase tracking-wider rounded-none font-semibold",
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
      className={`${shape} font-medium transition-all duration-200 inline-flex items-center justify-center gap-2 ${VARIANT_CLASSES[variant]} ${className}`}
      {...props}
    />
  );
}
