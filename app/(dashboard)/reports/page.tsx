import { Card } from "@/components/ui/card";
import { Icon } from "@/components/ui/icon";

// Reportes avanzados es Fase 3 del roadmap — placeholder honesto, ver
// comentario en app/(dashboard)/goals/page.tsx.
export default function ReportsPage() {
  return (
    <div className="max-w-2xl">
      <h1 className="text-2xl font-bold text-on-surface tracking-tight mb-6 flex items-center gap-2">
        <Icon name="bar_chart" className="text-primary" filled />
        Reportes
      </h1>
      <Card>
        <p className="text-on-surface font-medium mb-1">Próximamente</p>
        <p className="text-on-surface-variant text-sm">
          Reportes avanzados (Fase 3 del roadmap) — tendencias de gasto por
          categoría a lo largo de varios meses, comparativas año contra año.
          Todavía no está diseñado.
        </p>
      </Card>
    </div>
  );
}
