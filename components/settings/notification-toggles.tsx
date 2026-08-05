"use client";

import {
  useNotificationPreferences,
  useUpdateNotificationPreferences,
} from "@/lib/hooks/use-profile";
import type { Tables } from "@/types/supabase";

type ToggleKey = keyof Omit<
  Tables<"notification_preferences">,
  "user_id" | "updated_at"
>;

const TOGGLES: { key: ToggleKey; label: string }[] = [
  { key: "payment_reminders", label: "Recordatorios de pago" },
  { key: "budget_alerts", label: "Alertas de presupuesto" },
  { key: "unusual_transaction_alerts", label: "Transacciones inusuales" },
  { key: "savings_milestones", label: "Metas de ahorro alcanzadas" },
  { key: "cashback_opportunities", label: "Oportunidades de cashback" },
  { key: "weekly_summary", label: "Resumen semanal" },
  { key: "monthly_summary", label: "Resumen mensual" },
];

export function NotificationToggles() {
  const { data: prefs } = useNotificationPreferences();
  const updatePrefs = useUpdateNotificationPreferences();

  // Sin fila todavía (usuario nunca tocó esta sección): todos los defaults
  // de la migración, sin necesidad de esperar a que se cree para mostrar el
  // panel — el upsert la crea recién cuando cambian algo.
  const current: Record<ToggleKey, boolean> = {
    payment_reminders: prefs?.payment_reminders ?? true,
    budget_alerts: prefs?.budget_alerts ?? true,
    unusual_transaction_alerts: prefs?.unusual_transaction_alerts ?? true,
    savings_milestones: prefs?.savings_milestones ?? true,
    cashback_opportunities: prefs?.cashback_opportunities ?? false,
    weekly_summary: prefs?.weekly_summary ?? false,
    monthly_summary: prefs?.monthly_summary ?? true,
  };

  function toggle(key: ToggleKey) {
    updatePrefs.mutate({ ...current, [key]: !current[key] });
  }

  return (
    <div className="flex flex-col gap-3">
      <p className="text-xs text-on-surface-variant">
        Todavía no hay envío real de notificaciones (falta un proveedor de
        email/push) — esto guarda tu preferencia para cuando esa fase se
        active.
      </p>
      {TOGGLES.map((t) => (
        <label
          key={t.key}
          className="flex items-center justify-between gap-3 cursor-pointer"
        >
          <span className="text-on-surface text-sm">{t.label}</span>
          <input
            type="checkbox"
            checked={current[t.key]}
            onChange={() => toggle(t.key)}
            className="h-4 w-4 accent-secondary"
          />
        </label>
      ))}
    </div>
  );
}
