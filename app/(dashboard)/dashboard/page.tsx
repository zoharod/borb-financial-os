"use client";

import Link from "next/link";
import { Card } from "@/components/ui/card";
import { Icon } from "@/components/ui/icon";
import { AddExpenseButton } from "@/components/transactions/add-expense-button";
import { useCurrentHousehold } from "@/lib/hooks/use-current-household";
import {
  currentMonthISO,
  useDashboardSummary,
  type CurrencyTotals,
} from "@/lib/hooks/use-dashboard-summary";
import { useBudgets, useMonthlyActuals } from "@/lib/hooks/use-budgets";
import { useAccounts } from "@/lib/hooks/use-accounts";
import { useAccountBalances } from "@/lib/hooks/use-account-balances";
import { useCards } from "@/lib/hooks/use-cards";
import { useHouseholdMembers } from "@/lib/hooks/use-household-members";
import { useCommitments } from "@/lib/hooks/use-commitments";
import { useExpectedIncome } from "@/lib/hooks/use-expected-income";
import { ACCOUNT_TYPES } from "@/lib/constants";
import { nextOccurrenceOfDay, todayISO } from "@/lib/date";

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

function totalsList(totals: CurrencyTotals | undefined) {
  return Object.entries(totals ?? {}).filter(([, v]) => v !== 0);
}

export default function DashboardPage() {
  const { data: household } = useCurrentHousehold();
  const householdRow = household?.households as unknown as {
    name: string;
    base_currency_default: string;
  } | null;
  const primaryCurrency = householdRow?.base_currency_default ?? "HNL";

  const month = currentMonthISO();
  const today = todayISO();
  const { data: summary, isLoading } = useDashboardSummary(month, primaryCurrency);
  const { data: budgets } = useBudgets(month);
  const { data: actuals } = useMonthlyActuals(month);
  const { data: accounts } = useAccounts();
  const { data: balances } = useAccountBalances();
  const { data: cards } = useCards();
  const { data: members } = useHouseholdMembers();
  const { data: commitments } = useCommitments();
  const { data: incomes } = useExpectedIncome();

  const nonCardAccounts = (accounts ?? []).filter((a) => a.type !== "credit_card");

  const upcoming = [
    ...(incomes ?? [])
      .filter((i) => i.status !== "confirmed")
      .map((i) => ({
        date: i.expected_date,
        label: `Ingreso esperado: ${i.source}`,
        amount: Number(i.amount),
        currency: i.currency,
        kind: "income" as const,
      })),
    ...(commitments ?? [])
      .filter((c) => c.status === "active" && c.next_payment_date)
      .map((c) => ({
        date: c.next_payment_date as string,
        label: c.name,
        amount: Number(c.amount),
        currency: c.currency,
        kind: "commitment" as const,
      })),
    ...(cards ?? [])
      .filter((c) => c.payment_due_day)
      .map((c) => ({
        date: nextOccurrenceOfDay(c.payment_due_day as number),
        label: `Pago de tarjeta: ${c.name}`,
        amount: c.full_payment_amount ?? c.minimum_payment ?? 0,
        currency: primaryCurrency,
        kind: "card" as const,
      })),
  ]
    .filter((item) => item.date >= today)
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(0, 8);

  return (
    <div className="w-full space-y-6">
      <div className="flex items-baseline justify-between">
        <h1 className="text-2xl font-bold text-on-surface tracking-tight">
          Dashboard
        </h1>
        {householdRow?.name && (
          <span className="text-sm text-on-surface-variant">{householdRow.name}</span>
        )}
      </div>

      {isLoading ? (
        <p className="text-on-surface-variant text-sm">Cargando...</p>
      ) : (
        <>
          {/* 1. Posición financiera */}
          <section className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {totalsList(summary?.liquidBalance).length === 0 &&
            totalsList(summary?.cardDebt).length === 0 ? (
              <Card className="md:col-span-2">
                <p className="text-on-surface-variant text-sm">
                  Todavía no hay cuentas con saldo.
                </p>
              </Card>
            ) : (
              Array.from(
                new Set([
                  ...Object.keys(summary?.liquidBalance ?? {}),
                  ...Object.keys(summary?.cardDebt ?? {}),
                ]),
              ).map((currency) => {
                const liquid = summary?.liquidBalance[currency] ?? 0;
                const debt = summary?.cardDebt[currency] ?? 0;
                const expected = summary?.expectedIncomeThisMonth[currency] ?? 0;
                const committed =
                  (summary?.committedThisMonth[currency] ?? 0) +
                  (summary?.cardPaymentsDueThisMonth[currency] ?? 0);
                const projected = summary?.projectedBalance[currency] ?? liquid;

                return (
                  <Card key={currency} className="relative overflow-hidden p-6 md:p-8">
                    <div className="absolute top-0 right-0 w-64 h-64 bg-primary/10 blur-[80px] rounded-full pointer-events-none -translate-y-1/3 translate-x-1/3" />
                    <div className="relative z-10">
                      <p className="text-xs uppercase tracking-wider text-on-surface-variant mb-2">
                        Plata líquida · {currency}
                      </p>
                      <h2 className="text-4xl md:text-5xl font-bold text-on-surface tracking-tight">
                        {fmt(liquid)}
                      </h2>
                      {debt > 0 && (
                        <p className="text-sm text-error mt-2">
                          Debés {fmt(debt)} {currency} en tarjetas (no restado arriba)
                        </p>
                      )}
                      <div className="mt-4 pt-4 border-t border-outline-variant/20 space-y-1 text-sm">
                        <div className="flex justify-between text-on-surface-variant">
                          <span>+ Ingreso esperado este mes</span>
                          <span className="font-mono">{fmt(expected)}</span>
                        </div>
                        <div className="flex justify-between text-on-surface-variant">
                          <span>− Comprometido este mes</span>
                          <span className="font-mono">{fmt(committed)}</span>
                        </div>
                        <div className="flex justify-between text-on-surface font-semibold pt-1">
                          <span>Proyectado a fin de mes</span>
                          <span className="font-mono">{fmt(projected)}</span>
                        </div>
                      </div>
                    </div>
                  </Card>
                );
              })
            )}
          </section>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* 2. Cuentas */}
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
                {nonCardAccounts.length > 0 ? (
                  nonCardAccounts.map((account) => (
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
                          <p className="text-sm text-on-surface truncate">{account.name}</p>
                          <p className="text-xs text-on-surface-variant truncate">
                            {account.institution ?? ""}
                            {account.institution ? " · " : ""}
                            {ACCOUNT_TYPES.find((t) => t.value === account.type)?.label ??
                              account.type}
                          </p>
                        </div>
                        <span className="text-sm font-bold text-on-surface">
                          {fmt(balances?.[account.id] ?? 0)} {account.currency}
                        </span>
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="text-on-surface-variant text-sm">No hay cuentas todavía.</p>
                )}
              </div>
            </Card>

            {/* 3. Tarjetas de crédito */}
            <Card className="flex flex-col">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-bold text-on-surface">Tarjetas de crédito</h3>
                <Link
                  href="/household"
                  className="text-xs text-on-surface-variant hover:text-primary transition-colors"
                >
                  Administrar
                </Link>
              </div>
              <div className="space-y-3">
                {cards && cards.length > 0 ? (
                  cards.map((card) => {
                    const cardAccounts = (accounts ?? []).filter(
                      (a) => a.card_id === card.id,
                    );
                    const cardholder = members?.find((m) => m.user_id === card.cardholder_user_id);
                    const dueDate = card.payment_due_day
                      ? nextOccurrenceOfDay(card.payment_due_day)
                      : null;
                    const amountDue = card.full_payment_amount ?? card.minimum_payment;
                    return (
                      <div
                        key={card.id}
                        className="p-4 rounded-lg bg-surface-container-low border border-outline-variant/20"
                      >
                        <div className="flex items-center justify-between mb-2">
                          <div className="min-w-0">
                            <p className="text-sm text-on-surface truncate">{card.name}</p>
                            <p className="text-xs text-on-surface-variant truncate">
                              {card.bank ?? "Sin banco"}
                              {cardholder ? ` · ${cardholder.profiles?.full_name || "Sin nombre"}` : ""}
                            </p>
                          </div>
                        </div>
                        {cardAccounts.map((a) => (
                          <p key={a.id} className="text-sm text-error font-mono">
                            Debés {fmt(Math.abs(balances?.[a.id] ?? 0))} {a.currency}
                          </p>
                        ))}
                        {dueDate && amountDue && (
                          <p className="text-xs text-on-surface-variant mt-1">
                            Pago de {fmt(amountDue)} {primaryCurrency} vence el {dueDate}
                          </p>
                        )}
                      </div>
                    );
                  })
                ) : (
                  <p className="text-on-surface-variant text-sm">
                    No hay tarjetas todavía.
                  </p>
                )}
              </div>
            </Card>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* 4. Presupuesto vs. real */}
            <Card className="flex flex-col">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-bold text-on-surface">Presupuesto vs. real</h3>
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
                    const actual = actuals?.[`${budget.category_id}:${budget.currency}`] ?? 0;
                    const pct = Math.min(100, (actual / Number(budget.planned_amount)) * 100);
                    const exceeded = actual > Number(budget.planned_amount);

                    return (
                      <li key={budget.id}>
                        <div className="flex items-center justify-between mb-2">
                          <p className="text-sm text-on-surface">{budget.categories?.name}</p>
                          <span className="text-xs text-on-surface-variant">
                            {fmt(actual)} / {fmt(Number(budget.planned_amount))} {budget.currency}
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
              <p className="text-xs text-on-surface-variant mt-4 pt-4 border-t border-outline-variant/20">
                Solo gastos reales (excluye transferencias y pagos de tarjeta).
              </p>
            </Card>

            {/* 5. Próximos */}
            <Card className="flex flex-col">
              <h3 className="text-lg font-bold text-on-surface mb-4">Próximos</h3>
              {upcoming.length > 0 ? (
                <ul className="space-y-3">
                  {upcoming.map((item, i) => (
                    <li
                      key={i}
                      className="flex items-center justify-between text-sm"
                    >
                      <div className="min-w-0">
                        <p className="text-on-surface truncate">{item.label}</p>
                        <p className="text-xs text-on-surface-variant">{item.date}</p>
                      </div>
                      <span
                        className={`font-mono flex-shrink-0 ${
                          item.kind === "income" ? "text-secondary" : "text-on-surface"
                        }`}
                      >
                        {item.kind === "income" ? "+" : "−"}
                        {fmt(item.amount)} {item.currency}
                      </span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-on-surface-variant text-sm">
                  No hay ingresos esperados, cuotas ni pagos de tarjeta próximos.
                </p>
              )}
            </Card>
          </div>

          {/* 6. Acciones rápidas */}
          <Card>
            <h3 className="text-lg font-bold text-on-surface mb-4">Acciones rápidas</h3>
            <div className="flex flex-wrap gap-3">
              <AddExpenseButton type="expense" label="Agregar gasto" icon="remove" />
              <AddExpenseButton
                type="income"
                label="Agregar ingreso"
                icon="add"
                variant="secondary"
              />
              <AddExpenseButton
                type="transfer"
                label="Transferir"
                icon="swap_horiz"
                variant="secondary"
              />
              <AddExpenseButton
                type="card_payment"
                label="Pagar tarjeta"
                icon="credit_card"
                variant="secondary"
              />
            </div>
          </Card>
        </>
      )}
    </div>
  );
}
