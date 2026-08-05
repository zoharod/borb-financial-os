"use client";

import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input, Select, Label } from "@/components/ui/input";
import { useUpdateHouseholdSettings } from "@/lib/hooks/use-current-household";
import { CURRENCIES, BUDGET_PERIODS } from "@/lib/constants";

export function HouseholdSettingsForm({
  householdId,
  name,
  avatarUrl,
  primaryCurrency,
  secondaryCurrency,
  financialMonthStartDay,
  defaultBudgetPeriod,
  canEdit,
}: {
  householdId: string;
  name: string;
  avatarUrl: string | null;
  primaryCurrency: string;
  secondaryCurrency: string | null;
  financialMonthStartDay: number;
  defaultBudgetPeriod: string;
  canEdit: boolean;
}) {
  const updateSettings = useUpdateHouseholdSettings();
  const [form, setForm] = useState({
    name,
    avatarUrl: avatarUrl ?? "",
    primaryCurrency,
    secondaryCurrency: secondaryCurrency ?? "",
    financialMonthStartDay,
    defaultBudgetPeriod,
  });
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaved(false);
    try {
      await updateSettings.mutateAsync({
        householdId,
        name: form.name,
        avatar_url: form.avatarUrl || null,
        base_currency_default: form.primaryCurrency,
        secondary_currency: form.secondaryCurrency || null,
        financial_month_start_day: form.financialMonthStartDay,
        default_budget_period: form.defaultBudgetPeriod,
      });
      setSaved(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo guardar");
    }
  }

  return (
    <Card>
      <p className="font-mono text-xs uppercase tracking-wider text-on-surface-variant mb-4">
        Configuración del hogar
      </p>
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div>
          <Label>Nombre del hogar</Label>
          <Input
            value={form.name}
            disabled={!canEdit}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
          />
        </div>
        <div>
          <Label>URL de ícono/avatar (opcional)</Label>
          <Input
            value={form.avatarUrl}
            disabled={!canEdit}
            onChange={(e) => setForm({ ...form, avatarUrl: e.target.value })}
            placeholder="https://..."
          />
        </div>
        <div className="flex gap-4">
          <div className="flex-1">
            <Label>Moneda primaria</Label>
            <Select
              value={form.primaryCurrency}
              disabled={!canEdit}
              onChange={(e) =>
                setForm({ ...form, primaryCurrency: e.target.value })
              }
            >
              {CURRENCIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </Select>
          </div>
          <div className="flex-1">
            <Label>Moneda secundaria</Label>
            <Select
              value={form.secondaryCurrency}
              disabled={!canEdit}
              onChange={(e) =>
                setForm({ ...form, secondaryCurrency: e.target.value })
              }
            >
              <option value="">Ninguna</option>
              {CURRENCIES.filter((c) => c !== form.primaryCurrency).map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </Select>
          </div>
        </div>
        <div className="flex gap-4">
          <div className="flex-1">
            <Label>Día de inicio del mes financiero</Label>
            <Input
              type="number"
              min={1}
              max={28}
              disabled={!canEdit}
              value={form.financialMonthStartDay}
              onChange={(e) =>
                setForm({
                  ...form,
                  financialMonthStartDay: Number(e.target.value),
                })
              }
            />
          </div>
          <div className="flex-1">
            <Label>Período de presupuesto por defecto</Label>
            <Select
              value={form.defaultBudgetPeriod}
              disabled={!canEdit}
              onChange={(e) =>
                setForm({ ...form, defaultBudgetPeriod: e.target.value })
              }
            >
              {BUDGET_PERIODS.map((p) => (
                <option key={p.value} value={p.value}>
                  {p.label}
                </option>
              ))}
            </Select>
          </div>
        </div>

        {!canEdit && (
          <p className="text-sm text-on-surface-variant">
            Solo el dueño o un administrador pueden editar esta sección.
          </p>
        )}
        {error && (
          <p className="text-sm text-error" role="alert">
            {error}
          </p>
        )}
        {saved && !error && (
          <p className="text-sm text-secondary">Guardado.</p>
        )}

        {canEdit && (
          <div>
            <Button type="submit" disabled={updateSettings.isPending}>
              {updateSettings.isPending ? "Guardando..." : "Guardar cambios"}
            </Button>
          </div>
        )}
      </form>
    </Card>
  );
}
