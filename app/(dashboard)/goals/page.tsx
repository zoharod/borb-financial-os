import { Card } from "@/components/ui/card";
import { Icon } from "@/components/ui/icon";

// Metas de ahorro es Fase 3 del roadmap — no hay spec de producto todavía
// (solo el hueco de navegación pedido en el feedback de UX). Placeholder
// honesto en vez de fabricar una feature a medias, mismo criterio que
// "Cashback: Próximamente" en /cards.
export default function GoalsPage() {
  return (
    <div className="max-w-2xl">
      <h1 className="text-2xl font-bold text-on-surface tracking-tight mb-6 flex items-center gap-2">
        <Icon name="flag" className="text-primary" filled />
        Metas
      </h1>
      <Card>
        <p className="text-on-surface font-medium mb-1">Próximamente</p>
        <p className="text-on-surface-variant text-sm">
          Metas de ahorro (Fase 3 del roadmap) — definir cuánto querés ahorrar
          para algo puntual y hacerle seguimiento. Todavía no está diseñado.
        </p>
      </Card>
    </div>
  );
}
