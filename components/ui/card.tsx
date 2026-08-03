export function Card({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`rounded-lg bg-surface-container p-6 border border-outline-variant/20 ${className}`}
    >
      {children}
    </div>
  );
}
