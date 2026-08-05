import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export function StepShell({
  step,
  total,
  title,
  description,
  onBack,
  wide,
  children,
}: {
  step: number;
  total: number;
  title: string;
  description: string;
  onBack?: () => void;
  wide?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-1 items-start justify-center px-5 py-10">
      <Card
        className={`relative overflow-hidden ${wide ? "w-full max-w-2xl" : "w-full max-w-sm"}`}
      >
        <div className="absolute top-0 right-0 w-64 h-64 bg-primary/10 blur-[80px] rounded-full pointer-events-none -translate-y-1/2 translate-x-1/3" />
        <div className="relative z-10">
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs uppercase tracking-wider text-on-surface-variant">
              Paso {step} de {total}
            </p>
            {onBack && (
              <Button variant="tertiary" onClick={onBack}>
                Atrás
              </Button>
            )}
          </div>
          <div className="h-1.5 rounded-full bg-surface-container-high overflow-hidden mb-6">
            <div
              className="h-full rounded-full bg-primary glow-active transition-all duration-300"
              style={{ width: `${(step / total) * 100}%` }}
            />
          </div>
          <h1 className="text-2xl font-bold text-on-surface tracking-tight mb-1">
            {title}
          </h1>
          <p className="text-sm text-on-surface-variant mb-6">{description}</p>
          {children}
        </div>
      </Card>
    </div>
  );
}
