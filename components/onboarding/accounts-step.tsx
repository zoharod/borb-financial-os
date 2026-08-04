"use client";

import { useState } from "react";
import { StepShell } from "./step-shell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input, Select, Label } from "@/components/ui/input";
import { useAccounts, useCreateAccount } from "@/lib/hooks/use-accounts";
import { useCreateTransaction } from "@/lib/hooks/use-transactions";
import { CURRENCIES, ACCOUNT_TYPES } from "@/lib/constants";
import { todayISO } from "@/lib/date";

// Las tarjetas de crédito se cargan en su propio paso (Paso 3) — acá solo
// cuentas "normales" (efectivo, corriente, ahorro, inversión).
const NON_CARD_ACCOUNT_TYPES = ACCOUNT_TYPES.filter(
  (t) => t.value !== "credit_card",
);

export function AccountsStep({
  householdId,
  onBack,
  onContinue,
}: {
  householdId: string;
  onBack?: () => void;
  onContinue: () => void;
}) {
  const { data: accounts } = useAccounts();
  const createAccount = useCreateAccount();
  const createTransaction = useCreateTransaction();

  const [name, setName] = useState("");
  const [type, setType] =
    useState<(typeof NON_CARD_ACCOUNT_TYPES)[number]["value"]>("checking");
  const [currency, setCurrency] = useState<(typeof CURRENCIES)[number]>("HNL");
  const [balance, setBalance] = useState("");
  const [institution, setInstitution] = useState("");
  const [error, setError] = useState<string | null>(null);

  const nonCardAccounts = (accounts ?? []).filter(
    (a) => a.type !== "credit_card",
  );

  function resetForm() {
    setName("");
    setBalance("");
    setInstitution("");
  }

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    try {
      const account = await createAccount.mutateAsync({
        household_id: householdId,
        name,
        type,
        currency,
        institution: institution || null,
      });

      const initialBalance = Number(balance);
      if (account && initialBalance !== 0 && !Number.isNaN(initialBalance)) {
        await createTransaction.mutateAsync({
          household_id: householdId,
          account_id: account.id,
          to_account_id: null,
          category_id: null,
          type: "adjustment",
          amount: initialBalance,
          currency,
          description: "Saldo inicial",
          transaction_date: todayISO(),
        });
      }

      resetForm();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al crear la cuenta");
    }
  }

  const isSaving = createAccount.isPending || createTransaction.isPending;

  return (
    <StepShell
      step={2}
      total={5}
      title="Agregá tus cuentas"
      description="Efectivo, cuentas corrientes, ahorro o inversión. Agregá todas las que uses — vas a poder seguir sumando o editando después."
      onBack={onBack}
      wide
    >
      <form onSubmit={handleAdd} className="flex flex-col gap-4 mb-6">
        <div className="flex gap-4">
          <div className="flex-1">
            <Label>Nombre</Label>
            <Input
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Pagos L, Ahorro $, Efectivo..."
            />
          </div>
          <div className="flex-1">
            <Label>Banco o institución (opcional)</Label>
            <Input
              value={institution}
              onChange={(e) => setInstitution(e.target.value)}
              placeholder="BAC, Ficohsa, ..."
            />
          </div>
        </div>

        <div className="flex gap-4">
          <div className="flex-1">
            <Label>Tipo</Label>
            <Select
              value={type}
              onChange={(e) =>
                setType(
                  e.target.value as (typeof NON_CARD_ACCOUNT_TYPES)[number]["value"],
                )
              }
            >
              {NON_CARD_ACCOUNT_TYPES.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </Select>
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
          <div className="flex-1">
            <Label>Saldo actual (opcional)</Label>
            <Input
              type="number"
              step="0.01"
              value={balance}
              onChange={(e) => setBalance(e.target.value)}
              placeholder="0.00"
            />
          </div>
        </div>

        {error && (
          <p className="text-sm text-error" role="alert">
            {error}
          </p>
        )}

        <Button type="submit" variant="secondary" disabled={isSaving}>
          {isSaving ? "Agregando..." : "Agregar cuenta"}
        </Button>
      </form>

      {nonCardAccounts.length > 0 && (
        <ul className="space-y-2 mb-6">
          {nonCardAccounts.map((a) => (
            <li key={a.id}>
              <Card className="flex items-center justify-between py-3">
                <div>
                  <p className="text-on-surface font-medium">{a.name}</p>
                  <p className="text-on-surface-variant text-xs font-mono">
                    {a.currency} ·{" "}
                    {NON_CARD_ACCOUNT_TYPES.find((t) => t.value === a.type)
                      ?.label ?? a.type}
                    {a.institution ? ` · ${a.institution}` : ""}
                  </p>
                </div>
              </Card>
            </li>
          ))}
        </ul>
      )}

      <Button
        onClick={onContinue}
        disabled={nonCardAccounts.length === 0}
      >
        Continuar
      </Button>
      {nonCardAccounts.length === 0 && (
        <p className="text-on-surface-variant text-xs mt-2">
          Agregá al menos una cuenta para continuar.
        </p>
      )}
    </StepShell>
  );
}
