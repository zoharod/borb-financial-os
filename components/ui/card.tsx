export function Card({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`glass-panel rounded-lg p-6 ${className}`}>{children}</div>
  );
}
