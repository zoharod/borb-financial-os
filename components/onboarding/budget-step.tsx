"use client";

import { useState } from "react";
import { StepShell } from "./step-shell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input, Select, Label } from "@/components/ui/input";
import { useCategories, useCreateCategory } from "@/lib/hooks/use-categories";
import { useBudgets, useCreateBudget } from "@/lib/hooks/use-budgets";
import { currentMonthISO } from "@/lib/hooks/use-dashboard-summary";
import { BUDGET_CATEGORIES, EXTRA_CATEGORY_NAME, CURRENCIES } from "@/lib/constants";

export function BudgetStep({
  householdId,
  onBack,
  onContinue,
}: {
  householdId: string;
  onBack?: () => void;
  onContinue: () => void;
}) {
  const month = currentMonthISO();
  const { data: categories } = useCategories();
  const { data: budgets } = useBudgets(month);
  const createCategory = useCreateCategory();
  const createBudget = useCreateBudget();

  const [pendingName, setPendingName] = useState<string | null>(null);
  const [amount, setAmount] = useState("");
  const [currency, setCurrency] = useState<(typeof CURRENCIES)[number]>("HNL");
  const [customName, setCustomName] = useState("");
  const [error, setError] = useState<string | null>(null);

  const addedNames = new Set((categories ?? []).map((c) => c.name));

  function openPending(name: string) {
    setError(null);
    setAmount("");
    setPendingName(name);
  }

  async function confirmPending() {
    if (!pendingName) return;
    setError(null);

    const numericAmount = Number(amount);
    if (!amount || Number.isNaN(numericAmount) || numericAmount <= 0) {
      setError("Ingresá un monto mayor a cero.");
      return;
    }

    try {
      const category = await createCategory.mutateAsync({
        household_id: householdId,
        name: pendingName,
        is_extra_default: pendingName === EXTRA_CATEGORY_NAME,
      });

      await createBudget.mutateAsync({
        household_id: householdId,
        category_id: category.id,
        month,
        planned_amount: numericAmount,
        currency,
      });

      setPendingName(null);
      setAmount("");
      setCustomName("");
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Error al guardar el presupuesto",
      );
    }
  }

  const isSaving = createCategory.isPending || createBudget.isPending;
  const suggested = [...BUDGET_CATEGORIES, EXTRA_CATEGORY_NAME];

  return (
    <StepShell
      step={4}
      total={5}
      title="Configurá tu presupuesto mensual"
      description="Elegí las categorías que querés presupuestar este mes y asignales un monto. Podés saltear las que no te interesen por ahora."
      onBack={onBack}
      wide
    >
      <div className="flex flex-wrap gap-2 mb-4">
        {suggested
          .filter((name) => !addedNames.has(name))
          .map((name) => (
            <button
              key={name}
              type="button"
              onClick={() => openPending(name)}
              disabled={pendingName !== null}
              className="rounded-full border border-outline-variant px-3 py-1.5 text-sm text-on-surface hover:bg-surface-container-high disabled:opacity-50"
            >
              + {name}
            </button>
          ))}
      </div>

      {pendingName === null ? (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (customName.trim()) openPending(customName.trim());
          }}
          className="flex gap-2 mb-6"
        >
          <Input
            value={customName}
            onChange={(e) => setCustomName(e.target.value)}
            placeholder="Otra categoría..."
          />
          <Button type="submit" variant="secondary">
            Agregar
          </Button>
        </form>
      ) : (
        <Card className="mb-6">
          <p className="text-on-surface font-medium mb-3">{pendingName}</p>
          <div className="flex gap-3 items-end">
            <div className="flex-1">
              <Label>Monto mensual</Label>
              <Input
                type="number"
                step="0.01"
                min="0"
                autoFocus
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
              />
            </div>
            <div className="w-28">
              <Label>Moneda</Label>
              <Select
                value={currency}
                onChange={(e) =>
                  setCurrency(e.target.value as (typeof CURRENCIES)[number])
                }
              >
                {CURRENCIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </Select>
            </div>
          </div>
          {error && (
            <p className="text-sm text-error mt-3" role="alert">
              {error}
            </p>
          )}
          <div className="flex gap-2 justify-end mt-3">
            <Button variant="secondary" onClick={() => setPendingName(null)}>
              Cancelar
            </Button>
            <Button onClick={confirmPending} disabled={isSaving}>
              {isSaving ? "Guardando..." : "Guardar"}
            </Button>
          </div>
        </Card>
      )}

      {budgets && budgets.length > 0 && (
        <ul className="space-y-2 mb-6">
          {budgets.map((b) => (
            <li key={b.id}>
              <Card className="flex items-center justify-between py-3">
                <p className="text-on-surface">{b.categories?.name}</p>
                <p className="text-on-surface-variant font-mono text-sm">
                  {Number(b.planned_amount).toFixed(2)} {b.currency}
                </p>
              </Card>
            </li>
          ))}
        </ul>
      )}

      <Button onClick={onContinue}>Continuar</Button>
    </StepShell>
  );
}
