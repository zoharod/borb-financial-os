"use client";

import Link from "next/link";
import { Card } from "@/components/ui/card";
import { useCurrentHousehold } from "@/lib/hooks/use-current-household";
import {
  currentMonthISO,
  useDashboardSummary,
} from "@/lib/hooks/use-dashboard-summary";
import { useBudgets, useMonthlyActuals } from "@/lib/hooks/use-budgets";

const CURRENCIES = ["HNL", "USD"] as const;

function fmt(n: number) {
  return n.toLocaleString("es-HN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export default function DashboardPage() {
  const { data: household } = useCurrentHousehold();
  const month = currentMonthISO();
  const { data: summary, isLoading } = useDashboardSummary(month);
  const { data: budgets } = useBudgets(month);
  const { data: actuals } = useMonthlyActuals(month);

  return (
    <div className="max-w-3xl">
      <div className="flex items-baseline justify-between mb-6">
        <h1 className="text-xl font-semibold text-on-surface">Dashboard</h1>
        {household && (
          <span className="text-sm text-on-surface-variant font-mono">
            {(household.households as unknown as { name: string } | null)?.name}
          </span>
        )}
      </div>

      {isLoading ? (
        <p className="text-on-surface-variant text-sm">Cargando...</p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8">
          {CURRENCIES.map((currency) => {
            const income = summary?.monthlyIncome[currency] ?? 0;
            const expense = summary?.monthlyExpense[currency] ?? 0;
            const savings = income - expense;
            const balance = summary?.balance[currency] ?? 0;

            return (
              <Card key={currency}>
                <h2 className="font-mono text-xs uppercase tracking-wider text-on-surface-variant mb-4">
                  {currency}
                </h2>
                <dl className="space-y-2">
                  <div className="flex justify-between">
                    <dt className="text-on-surface-variant text-sm">
                      Ingresos del mes
                    </dt>
                    <dd className="text-on-surface font-mono">{fmt(income)}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-on-surface-variant text-sm">
                      Gastos del mes
                    </dt>
                    <dd className="text-on-surface font-mono">{fmt(expense)}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-on-surface-variant text-sm">Ahorro</dt>
                    <dd
                      className={`font-mono font-semibold ${
                        savings >= 0 ? "text-secondary" : "text-error"
                      }`}
                    >
                      {fmt(savings)}
                    </dd>
                  </div>
                  <div className="flex justify-between pt-2 border-t border-outline-variant/20">
                    <dt className="text-on-surface-variant text-sm">
                      Saldo disponible
                    </dt>
                    <dd className="text-on-surface font-mono text-lg font-semibold">
                      {fmt(balance)}
                    </dd>
                  </div>
                </dl>
              </Card>
            );
          })}
        </div>
      )}

      <div className="flex items-center justify-between mb-3">
        <h2 className="font-mono text-xs uppercase tracking-wider text-on-surface-variant">
          Presupuesto vs. real (este mes)
        </h2>
        <Link
          href="/budgets"
          className="text-xs text-on-surface-variant hover:text-on-surface underline"
        >
          Administrar
        </Link>
      </div>

      {budgets && budgets.length > 0 ? (
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
              <Card key={budget.id} className="py-4">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-on-surface font-medium">
                    {budget.categories?.name}
                  </p>
                  <span className="font-mono text-sm text-on-surface-variant">
                    {fmt(actual)} / {fmt(Number(budget.planned_amount))}{" "}
                    {budget.currency}
                  </span>
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
