"use client";

import Link from "next/link";
import { Card } from "@/components/ui/card";
import { Icon } from "@/components/ui/icon";
import { useCurrentHousehold } from "@/lib/hooks/use-current-household";
import {
  currentMonthISO,
  useDashboardSummary,
} from "@/lib/hooks/use-dashboard-summary";
import { useBudgets, useMonthlyActuals } from "@/lib/hooks/use-budgets";
import { useAccounts } from "@/lib/hooks/use-accounts";
import { useAccountBalances } from "@/lib/hooks/use-account-balances";
import { ACCOUNT_TYPES } from "@/lib/constants";

const CURRENCIES = ["HNL", "USD"] as const;

const ACCOUNT_ICONS: Record<string, string> = {
  checking: "account_balance",
  savings: "savings",
  credit_card: "credit_card",
};

function fmt(n: number) {
  return n.toLocaleString("es-HN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export default function DashboardPage() {
  const { data: household } = useCurrentHousehold();
  const month = currentMonthISO();
  const { data: summary, isLoading } = useDashboardSummary(month);
  const { data: budgets } = useBudgets(month);
  const { data: actuals } = useMonthlyActuals(month);
  const { data: accounts } = useAccounts();
  const { data: balances } = useAccountBalances();

  const householdName = (
    household?.households as unknown as { name: string } | null
  )?.name;

  return (
    <div className="w-full space-y-6">
      <div className="flex items-baseline justify-between">
        <h1 className="text-2xl font-bold text-on-surface tracking-tight">
          Dashboard
        </h1>
        {householdName && (
          <span className="text-sm text-on-surface-variant">
            {householdName}
          </span>
        )}
      </div>

      {isLoading ? (
        <p className="text-on-surface-variant text-sm">Cargando...</p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {CURRENCIES.map((currency) => {
            const income = summary?.monthlyIncome[currency] ?? 0;
            const expense = summary?.monthlyExpense[currency] ?? 0;
            const savings = income - expense;
            const balance = summary?.balance[currency] ?? 0;

            return (
              <Card
                key={currency}
                className="relative overflow-hidden p-6 md:p-8"
              >
                <div className="absolute top-0 right-0 w-64 h-64 bg-primary/10 blur-[80px] rounded-full pointer-events-none -translate-y-1/3 translate-x-1/3" />
                <div className="relative z-10">
                  <p className="text-xs uppercase tracking-wider text-on-surface-variant mb-2">
                    Saldo disponible · {currency}
                  </p>
                  <h2 className="text-4xl md:text-5xl font-bold text-on-surface tracking-tight">
                    {fmt(balance)}
                  </h2>
                  <div className="flex flex-wrap items-center gap-2 mt-4">
                    <span
                      className={`px-3 py-1 rounded-full text-xs font-semibold flex items-center gap-1 ${
                        savings >= 0
                          ? "bg-secondary/10 text-secondary"
                          : "bg-error/10 text-error"
                      }`}
                    >
                      <Icon
                        name={savings >= 0 ? "trending_up" : "trending_down"}
                        size={14}
                      />
                      Ahorro: {fmt(savings)}
                    </span>
                    <span className="text-xs text-on-surface-variant">
                      Ingresos {fmt(income)} · Gastos {fmt(expense)}
                    </span>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card className="flex flex-col">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-bold text-on-surface">Cuentas</h3>
            <Link
              href="/accounts"
              className="w-8 h-8 rounded-full bg-surface-container-high flex items-center justify-center hover:bg-primary/20 hover:text-primary transition-colors"
            >
              <Icon name="add" size={18} />
            </Link>
          </div>
          <div className="space-y-3">
            {accounts && accounts.length > 0 ? (
              accounts.map((account) => {
                const balance = balances?.[account.id] ?? 0;
                const isDebt = account.type === "credit_card" && balance < 0;
                return (
                  <div
                    key={account.id}
                    className="p-4 rounded-lg bg-surface-container-low border border-outline-variant/20"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-primary-container/20 flex items-center justify-center border border-primary/20 flex-shrink-0">
                        <Icon
                          name={ACCOUNT_ICONS[account.type] ?? "account_balance_wallet"}
                          className="text-primary"
                        />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-on-surface truncate">
                          {account.name}
                        </p>
                        <p className="text-xs text-on-surface-variant truncate">
                          {account.institution ?? ""}
                          {account.institution ? " · " : ""}
                          {ACCOUNT_TYPES.find((t) => t.value === account.type)
                            ?.label ?? account.type}
                        </p>
                      </div>
                      <span
                        className={`text-sm font-bold ${isDebt ? "text-error" : "text-on-surface"}`}
                      >
                        {fmt(balance)} {account.currency}
                      </span>
                    </div>
                  </div>
                );
              })
            ) : (
              <p className="text-on-surface-variant text-sm">
                No hay cuentas todavía.
              </p>
            )}
          </div>
        </Card>

        <Card className="flex flex-col">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-bold text-on-surface">
              Presupuesto vs. real
            </h3>
            <Link
              href="/budgets"
              className="text-xs text-on-surface-variant hover:text-primary transition-colors"
            >
              Administrar
            </Link>
          </div>
          {budgets && budgets.length > 0 ? (
            <ul className="space-y-4">
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
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-sm text-on-surface">
                        {budget.categories?.name}
                      </p>
                      <span className="text-xs text-on-surface-variant">
                        {fmt(actual)} / {fmt(Number(budget.planned_amount))}{" "}
                        {budget.currency}
                      </span>
                    </div>
                    <div className="h-2 rounded-full bg-surface-container-high overflow-hidden">
                      <div
                        className={`h-full rounded-full ${exceeded ? "bg-error" : "bg-secondary"}`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="text-on-surface-variant text-sm">
              No hay presupuesto definido para este mes.
            </p>
          )}
        </Card>
      </div>
    </div>
  );
}
