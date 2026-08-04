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
      <Card className={wide ? "w-full max-w-2xl" : "w-full max-w-sm"}>
        <div className="flex items-center justify-between mb-3">
          <p className="font-mono text-xs uppercase tracking-wider text-on-surface-variant">
            Paso {step} de {total}
          </p>
          {onBack && (
            <Button variant="tertiary" onClick={onBack}>
              Atrás
            </Button>
          )}
        </div>
        <h1 className="text-xl font-semibold text-on-surface mb-1">{title}</h1>
        <p className="text-sm text-on-surface-variant mb-6">{description}</p>
        {children}
      </Card>
    </div>
  );
}
