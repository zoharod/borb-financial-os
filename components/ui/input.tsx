import { InputHTMLAttributes, SelectHTMLAttributes } from "react";

const FIELD_CLASSES =
  "w-full rounded-sm bg-surface-container-lowest px-3 py-2 text-on-surface shadow-[inset_0_2px_4px_rgba(0,0,0,0.3)] outline-none focus:ring-2 focus:ring-secondary/30";

export function Input(props: InputHTMLAttributes<HTMLInputElement>) {
  const { className = "", ...rest } = props;
  return <input className={`${FIELD_CLASSES} ${className}`} {...rest} />;
}

export function Select(props: SelectHTMLAttributes<HTMLSelectElement>) {
  const { className = "", ...rest } = props;
  return <select className={`${FIELD_CLASSES} ${className}`} {...rest} />;
}

export function Label({ children }: { children: React.ReactNode }) {
  return (
    <label className="block text-sm text-on-surface-variant mb-1">
      {children}
    </label>
  );
}
