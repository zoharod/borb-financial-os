"use client";

import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input, Select, Label } from "@/components/ui/input";
import { useCurrentHousehold } from "@/lib/hooks/use-current-household";
import { useCategories } from "@/lib/hooks/use-categories";
import {
  useBudgets,
  useCreateBudget,
  useDeleteBudget,
  useMonthlyActuals,
} from "@/lib/hooks/use-budgets";
import { CURRENCIES } from "@/lib/constants";

function currentMonthISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
}

export default function BudgetsPage() {
  const { data: household } = useCurrentHousehold();
  const { data: categories } = useCategories();
  const [month, setMonth] = useState(currentMonthISO());
  const { data: budgets, isLoading } = useBudgets(month);
  const { data: actuals } = useMonthlyActuals(month);
  const createBudget = useCreateBudget();
  const deleteBudget = useDeleteBudget();

  const [categoryId, setCategoryId] = useState("");
  const [plannedAmount, setPlannedAmount] = useState("");
  const [currency, setCurrency] = useState<(typeof CURRENCIES)[number]>("HNL");
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!household) {
      setError("No se encontró tu household todavía.");
      return;
    }
    if (!categoryId) {
      setError("Elegí una categoría.");
      return;
    }

    try {
      await createBudget.mutateAsync({
        household_id: household.household_id,
        category_id: categoryId,
        month,
        planned_amount: Number(plannedAmount),
        currency,
      });
      setPlannedAmount("");
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Ya existe un presupuesto para esa categoría en este mes.",
      );
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("¿Eliminar este presupuesto?")) return;
    await deleteBudget.mutateAsync(id);
  }

  return (
    <div className="max-w-2xl">
      <h1 className="text-xl font-semibold text-on-surface mb-6">
        Presupuesto
      </h1>

      <div className="mb-6">
        <Label>Mes</Label>
        <input
          type="month"
          value={month.slice(0, 7)}
          onChange={(e) => setMonth(`${e.target.value}-01`)}
          className="rounded-sm bg-surface-container-lowest px-3 py-2 text-on-surface shadow-[inset_0_2px_4px_rgba(0,0,0,0.3)] outline-none focus:ring-2 focus:ring-secondary/30"
        />
      </div>

      <Card className="mb-6">
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div>
            <Label>Categoría</Label>
            <Select
              required
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
            >
              <option value="">Elegir...</option>
              {categories?.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </Select>
          </div>

          <div className="flex gap-4">
            <div className="flex-1">
              <Label>Monto planeado</Label>
              <Input
                type="number"
                step="0.01"
                min="0"
                required
                value={plannedAmount}
                onChange={(e) => setPlannedAmount(e.target.value)}
              />
            </div>
            <div className="flex-1">
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
            <p className="text-sm text-error" role="alert">
              {error}
            </p>
          )}

          <Button type="submit" disabled={createBudget.isPending}>
            {createBudget.isPending ? "Guardando..." : "Agregar presupuesto"}
          </Button>
        </form>
      </Card>

      {isLoading ? (
        <p className="text-on-surface-variant text-sm">Cargando...</p>
      ) : budgets && budgets.length > 0 ? (
        <ul className="space-y-3">
          {budgets.map((budget) => {
            const actual =
              actuals?.[`${budget.category_id}:${budget.currency}`] ?? 0;
            const pct = Math.min(
              100,
              (actual / Number(budget.planned_amount)) * 100,
            );
            const exceeded = actual > Number(budget.planned_amount);

            return (
              <li key={budget.id}>
                <Card className="py-4">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-on-surface font-medium">
                      {budget.categories?.name}
                    </p>
                    <div className="flex items-center gap-4">
                      <span className="font-mono text-sm text-on-surface-variant">
                        {actual.toFixed(2)} / {Number(budget.planned_amount).toFixed(2)}{" "}
                        {budget.currency}
                      </span>
                      <Button
                        variant="danger"
                        onClick={() => handleDelete(budget.id)}
                      >
                        Eliminar
                      </Button>
                    </div>
                  </div>
                  <div className="h-2 rounded-full bg-surface-container-lowest overflow-hidden">
                    <div
                      className={`h-full rounded-full ${
                        exceeded ? "bg-error" : "bg-secondary"
                      }`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </Card>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="text-on-surface-variant text-sm">
          No hay presupuesto definido para este mes.
        </p>
      )}
    </div>
  );
}
