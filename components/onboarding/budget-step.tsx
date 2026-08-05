"use client";

import { useState } from "react";
import { StepShell } from "./step-shell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input, Select, Label } from "@/components/ui/input";
import {
  useCategories,
  useCreateCategory,
  useUpdateCategory,
} from "@/lib/hooks/use-categories";
import {
  useBudgets,
  useCreateBudget,
  useDeleteBudget,
  useUpdateBudget,
  type BudgetWithCategory,
} from "@/lib/hooks/use-budgets";
import { currentMonthISO } from "@/lib/hooks/use-dashboard-summary";
import { BUDGET_CATEGORIES, EXTRA_CATEGORY_NAME, CURRENCIES } from "@/lib/constants";

const SUGGESTED_NAMES = new Set<string>([...BUDGET_CATEGORIES, EXTRA_CATEGORY_NAME]);

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

  const budgetTotals: Record<string, number> = {};
  for (const b of budgets ?? []) {
    budgetTotals[b.currency] = (budgetTotals[b.currency] ?? 0) + Number(b.planned_amount);
  }

  return (
    <StepShell
      step={4}
      total={7}
      title="Configurá tu presupuesto mensual"
      description="Elegí las categorías que querés presupuestar este mes y asignales un monto. Podés editar o quitar cualquiera antes de continuar."
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
        <>
          <ul className="space-y-2 mb-3">
            {budgets.map((b) => (
              <li key={b.id}>
                <BudgetRow budget={b} isCustom={!SUGGESTED_NAMES.has(b.categories?.name ?? "")} />
              </li>
            ))}
          </ul>
          <div className="mb-6 pt-2 border-t border-outline-variant/20">
            {Object.entries(budgetTotals).map(([cur, total]) => (
              <p key={cur} className="text-on-surface-variant text-sm font-mono">
                Total {cur}: {total.toFixed(2)}
              </p>
            ))}
          </div>
        </>
      )}

      <Button onClick={onContinue}>Continuar</Button>
    </StepShell>
  );
}

function BudgetRow({
  budget,
  isCustom,
}: {
  budget: BudgetWithCategory;
  isCustom: boolean;
}) {
  const updateBudget = useUpdateBudget();
  const updateCategory = useUpdateCategory();
  const deleteBudget = useDeleteBudget();

  const [isEditing, setIsEditing] = useState(false);
  const [name, setName] = useState(budget.categories?.name ?? "");
  const [amount, setAmount] = useState(String(budget.planned_amount));
  const [currency, setCurrency] = useState<(typeof CURRENCIES)[number]>(
    budget.currency as (typeof CURRENCIES)[number],
  );
  const [error, setError] = useState<string | null>(null);

  async function handleSave() {
    setError(null);
    const numericAmount = Number(amount);
    if (!amount || Number.isNaN(numericAmount) || numericAmount <= 0) {
      setError("Ingresá un monto mayor a cero.");
      return;
    }
    try {
      if (isCustom && name.trim() && name !== budget.categories?.name) {
        await updateCategory.mutateAsync({ id: budget.category_id, name: name.trim() });
      }
      await updateBudget.mutateAsync({
        id: budget.id,
        planned_amount: numericAmount,
        currency,
      });
      setIsEditing(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al guardar");
    }
  }

  async function handleRemove() {
    await deleteBudget.mutateAsync(budget.id);
  }

  if (isEditing) {
    return (
      <Card className="py-3">
        <div className="flex flex-col gap-3">
          <div className="flex gap-3 items-end">
            {isCustom ? (
              <div className="flex-1">
                <Label>Categoría</Label>
                <Input value={name} onChange={(e) => setName(e.target.value)} />
              </div>
            ) : (
              <div className="flex-1">
                <p className="text-on-surface">{budget.categories?.name}</p>
              </div>
            )}
            <div className="flex-1">
              <Label>Monto</Label>
              <Input
                type="number"
                step="0.01"
                min="0"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
              />
            </div>
            <div className="w-24">
              <Label>Moneda</Label>
              <Select
                value={currency}
                onChange={(e) => setCurrency(e.target.value as (typeof CURRENCIES)[number])}
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
            <p className="text-sm text-error" role="alert">
              {error}
            </p>
          )}
          <div className="flex gap-2 justify-end">
            <Button variant="secondary" onClick={() => setIsEditing(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSave} disabled={updateBudget.isPending}>
              {updateBudget.isPending ? "Guardando..." : "Guardar"}
            </Button>
          </div>
        </div>
      </Card>
    );
  }

  return (
    <Card className="flex items-center justify-between py-3">
      <p className="text-on-surface">{budget.categories?.name}</p>
      <div className="flex items-center gap-3">
        <p className="text-on-surface-variant font-mono text-sm">
          {Number(budget.planned_amount).toFixed(2)} {budget.currency}
        </p>
        <Button variant="tertiary" onClick={() => setIsEditing(true)}>
          Editar
        </Button>
        <Button variant="tertiary" onClick={handleRemove}>
          Quitar
        </Button>
      </div>
    </Card>
  );
}
