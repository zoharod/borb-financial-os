"use client";

import { useState } from "react";
import { StepShell } from "./step-shell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useCurrentHousehold } from "@/lib/hooks/use-current-household";
import { useAccounts } from "@/lib/hooks/use-accounts";
import { useAccountBalances } from "@/lib/hooks/use-account-balances";
import { useCards } from "@/lib/hooks/use-cards";
import { useHouseholdMembers } from "@/lib/hooks/use-household-members";
import { useBudgets } from "@/lib/hooks/use-budgets";
import { useCommitments } from "@/lib/hooks/use-commitments";
import { useExpectedIncome } from "@/lib/hooks/use-expected-income";
import { currentMonthISO } from "@/lib/hooks/use-dashboard-summary";
import type { OnboardingStep } from "@/lib/hooks/use-current-household";

type HouseholdRow = {
  name: string;
  base_currency_default: string;
  secondary_currency: string | null;
};

function getHouseholdRow(
  household: ReturnType<typeof useCurrentHousehold>["data"],
): HouseholdRow | null {
  if (!household) return null;
  return household.households as unknown as HouseholdRow | null;
}

export function ReviewStep({
  onEditStep,
  onBack,
  onFinish,
  isFinishing,
}: {
  onEditStep: (step: OnboardingStep) => void;
  onBack?: () => void;
  onFinish: () => void;
  isFinishing: boolean;
}) {
  const { data: household } = useCurrentHousehold();
  const { data: accounts } = useAccounts();
  const { data: balances } = useAccountBalances();
  const { data: cards } = useCards();
  const { data: members } = useHouseholdMembers();
  const { data: budgets } = useBudgets(currentMonthISO());
  const { data: commitments } = useCommitments();
  const { data: incomes } = useExpectedIncome();
  const [error] = useState<string | null>(null);

  const householdRow = getHouseholdRow(household);
  const nonCardAccounts = (accounts ?? []).filter((a) => a.type !== "credit_card");

  const budgetTotals: Record<string, number> = {};
  for (const b of budgets ?? []) {
    budgetTotals[b.currency] =
      (budgetTotals[b.currency] ?? 0) + Number(b.planned_amount);
  }

  return (
    <StepShell
      step={7}
      total={7}
      title="Revisá antes de terminar"
      description="Podés editar cualquier sección antes de confirmar."
      onBack={onBack}
      wide
    >
      <div className="flex flex-col gap-4 mb-6">
        <Card>
          <div className="flex items-center justify-between mb-2">
            <p className="font-mono text-xs uppercase tracking-wider text-on-surface-variant">
              Hogar
            </p>
            <Button variant="tertiary" onClick={() => onEditStep("household")}>
              Editar
            </Button>
          </div>
          <p className="text-on-surface">{householdRow?.name}</p>
          <p className="text-on-surface-variant text-sm">
            {householdRow?.base_currency_default}
            {householdRow?.secondary_currency
              ? ` + ${householdRow.secondary_currency}`
              : ""}
          </p>
        </Card>

        <Card>
          <div className="flex items-center justify-between mb-2">
            <p className="font-mono text-xs uppercase tracking-wider text-on-surface-variant">
              Cuentas
            </p>
            <Button variant="tertiary" onClick={() => onEditStep("accounts")}>
              Editar
            </Button>
          </div>
          {nonCardAccounts.length === 0 ? (
            <p className="text-error text-sm">Falta agregar al menos una cuenta.</p>
          ) : (
            <ul className="space-y-1">
              {nonCardAccounts.map((a) => (
                <li
                  key={a.id}
                  className="flex justify-between text-sm text-on-surface"
                >
                  <span>{a.name}</span>
                  <span className="font-mono">
                    {(balances?.[a.id] ?? 0).toFixed(2)} {a.currency}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card>
          <div className="flex items-center justify-between mb-2">
            <p className="font-mono text-xs uppercase tracking-wider text-on-surface-variant">
              Tarjetas de crédito
            </p>
            <Button variant="tertiary" onClick={() => onEditStep("cards")}>
              Editar
            </Button>
          </div>
          {!cards || cards.length === 0 ? (
            <p className="text-on-surface-variant text-sm">Ninguna agregada.</p>
          ) : (
            <ul className="space-y-1">
              {cards.map((c) => {
                const cardAccounts = (accounts ?? []).filter(
                  (a) => a.card_id === c.id,
                );
                const cardholder = members?.find((m) => m.user_id === c.cardholder_user_id);
                return (
                  <li key={c.id} className="text-sm">
                    <p className="text-on-surface">
                      {c.name}
                      {cardholder ? ` · ${cardholder.profiles?.full_name || "Sin nombre"}` : ""}
                    </p>
                    {cardAccounts.map((a) => {
                      const bal = balances?.[a.id] ?? 0;
                      return (
                        <p
                          key={a.id}
                          className="text-on-surface-variant font-mono pl-3"
                        >
                          {bal < 0 ? "Debés" : "A favor"}: {Math.abs(bal).toFixed(2)}{" "}
                          {a.currency}
                        </p>
                      );
                    })}
                  </li>
                );
              })}
            </ul>
          )}
        </Card>

        <Card>
          <div className="flex items-center justify-between mb-2">
            <p className="font-mono text-xs uppercase tracking-wider text-on-surface-variant">
              Presupuesto mensual
            </p>
            <Button variant="tertiary" onClick={() => onEditStep("budget")}>
              Editar
            </Button>
          </div>
          {!budgets || budgets.length === 0 ? (
            <p className="text-on-surface-variant text-sm">
              No definiste presupuesto todavía. Podés hacerlo después desde
              Presupuesto.
            </p>
          ) : (
            <>
              <ul className="space-y-1 mb-2">
                {budgets.map((b) => (
                  <li
                    key={b.id}
                    className="flex justify-between text-sm text-on-surface"
                  >
                    <span>{b.categories?.name}</span>
                    <span className="font-mono">
                      {Number(b.planned_amount).toFixed(2)} {b.currency}
                    </span>
                  </li>
                ))}
              </ul>
              <div className="pt-2 border-t border-outline-variant/20">
                {Object.entries(budgetTotals).map(([currency, total]) => (
                  <p
                    key={currency}
                    className="text-on-surface-variant text-sm font-mono"
                  >
                    Total {currency}: {total.toFixed(2)}
                  </p>
                ))}
              </div>
            </>
          )}
        </Card>

        <Card>
          <div className="flex items-center justify-between mb-2">
            <p className="font-mono text-xs uppercase tracking-wider text-on-surface-variant">
              Cuotas y compromisos
            </p>
            <Button variant="tertiary" onClick={() => onEditStep("commitments")}>
              Editar
            </Button>
          </div>
          {!commitments || commitments.length === 0 ? (
            <p className="text-on-surface-variant text-sm">Ninguno agregado.</p>
          ) : (
            <ul className="space-y-1">
              {commitments.map((c) => (
                <li key={c.id} className="flex justify-between text-sm text-on-surface">
                  <span>{c.name}</span>
                  <span className="font-mono">
                    {Number(c.amount).toFixed(2)} {c.currency}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card>
          <div className="flex items-center justify-between mb-2">
            <p className="font-mono text-xs uppercase tracking-wider text-on-surface-variant">
              Ingreso esperado
            </p>
            <Button variant="tertiary" onClick={() => onEditStep("income")}>
              Editar
            </Button>
          </div>
          {!incomes || incomes.length === 0 ? (
            <p className="text-on-surface-variant text-sm">Ninguno agregado.</p>
          ) : (
            <ul className="space-y-1">
              {incomes.map((i) => (
                <li key={i.id} className="flex justify-between text-sm text-on-surface">
                  <span>
                    {i.source} · {i.expected_date}
                  </span>
                  <span className="font-mono">
                    {Number(i.amount).toFixed(2)} {i.currency}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      {error && (
        <p className="text-sm text-error mb-4" role="alert">
          {error}
        </p>
      )}

      <Button onClick={onFinish} disabled={isFinishing}>
        {isFinishing ? "Guardando..." : "Finalizar"}
      </Button>
    </StepShell>
  );
}
