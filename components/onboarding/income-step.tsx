"use client";

import { useState } from "react";
import { StepShell } from "./step-shell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input, Select, Label } from "@/components/ui/input";
import { useAccounts } from "@/lib/hooks/use-accounts";
import { useHouseholdMembers } from "@/lib/hooks/use-household-members";
import {
  useCreateExpectedIncome,
  useExpectedIncome,
} from "@/lib/hooks/use-expected-income";
import { CURRENCIES } from "@/lib/constants";
import { todayISO } from "@/lib/date";

const FREQUENCIES = [
  { value: "monthly", label: "Mensual" },
  { value: "biweekly", label: "Quincenal" },
  { value: "weekly", label: "Semanal" },
  { value: "one_time", label: "Una vez" },
] as const;

export function IncomeStep({
  householdId,
  onBack,
  onContinue,
}: {
  householdId: string;
  onBack?: () => void;
  onContinue: () => void;
}) {
  const { data: accounts } = useAccounts();
  const { data: members } = useHouseholdMembers();
  const { data: incomes } = useExpectedIncome();
  const createIncome = useCreateExpectedIncome();

  const [source, setSource] = useState("");
  const [amount, setAmount] = useState("");
  const [currency, setCurrency] = useState<(typeof CURRENCIES)[number]>("HNL");
  const [expectedDate, setExpectedDate] = useState(todayISO());
  const [frequency, setFrequency] =
    useState<(typeof FREQUENCIES)[number]["value"]>("monthly");
  const [memberUserId, setMemberUserId] = useState("");
  const [destinationAccountId, setDestinationAccountId] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function resetForm() {
    setSource("");
    setAmount("");
    setConfirmed(false);
  }

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await createIncome.mutateAsync({
        household_id: householdId,
        source,
        amount: Number(amount),
        currency,
        expected_date: expectedDate,
        frequency,
        household_member_user_id: memberUserId || null,
        destination_account_id: destinationAccountId || null,
        status: confirmed ? "confirmed" : "estimated",
      });
      resetForm();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Error al guardar el ingreso",
      );
    }
  }

  return (
    <StepShell
      step={6}
      total={7}
      title="Ingreso esperado"
      description="Salario, freelance, reembolsos u otra plata que sabés que va a entrar. No cuenta como recibido hasta que lo confirmes o lo registres como transacción real — es opcional."
      onBack={onBack}
      wide
    >
      <form onSubmit={handleAdd} className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-4 mb-6">
        <div>
          <Label>Fuente</Label>
          <Input
            required
            value={source}
            onChange={(e) => setSource(e.target.value)}
            placeholder="Salario, Freelance, ..."
          />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label>Monto esperado</Label>
            <Input
              type="number"
              step="0.01"
              required
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
          </div>
          <div>
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

        <div>
          <Label>Fecha esperada</Label>
          <Input
            type="date"
            required
            value={expectedDate}
            onChange={(e) => setExpectedDate(e.target.value)}
          />
        </div>
        <div>
          <Label>Frecuencia</Label>
          <Select
            value={frequency}
            onChange={(e) =>
              setFrequency(e.target.value as (typeof FREQUENCIES)[number]["value"])
            }
          >
            {FREQUENCIES.map((f) => (
              <option key={f.value} value={f.value}>
                {f.label}
              </option>
            ))}
          </Select>
        </div>

        <div>
          <Label>Miembro del hogar (opcional)</Label>
          <Select value={memberUserId} onChange={(e) => setMemberUserId(e.target.value)}>
            <option value="">Sin especificar</option>
            {members?.map((m) => (
              <option key={m.user_id} value={m.user_id}>
                {m.profiles?.full_name || "Sin nombre"}
              </option>
            ))}
          </Select>
        </div>
        <div>
          <Label>Cuenta destino (opcional)</Label>
          <Select
            value={destinationAccountId}
            onChange={(e) => setDestinationAccountId(e.target.value)}
          >
            <option value="">Sin especificar</option>
            {accounts?.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name} ({a.currency})
              </option>
            ))}
          </Select>
        </div>

        <label className="flex items-center gap-2 text-sm text-on-surface-variant sm:col-span-2">
          <input
            type="checkbox"
            checked={confirmed}
            onChange={(e) => setConfirmed(e.target.checked)}
            className="rounded border-outline-variant/50"
          />
          Ya está confirmado (no es una estimación)
        </label>

        {error && (
          <p className="text-sm text-error sm:col-span-2" role="alert">
            {error}
          </p>
        )}

        <Button
          type="submit"
          variant="secondary"
          disabled={createIncome.isPending}
          className="sm:col-span-2"
        >
          {createIncome.isPending ? "Agregando..." : "Agregar ingreso"}
        </Button>
      </form>

      {incomes && incomes.length > 0 && (
        <ul className="space-y-2 mb-6">
          {incomes.map((i) => (
            <li key={i.id}>
              <Card className="flex items-center justify-between py-3">
                <div>
                  <p className="text-on-surface">{i.source}</p>
                  <p className="text-on-surface-variant text-xs">
                    {i.expected_date} ·{" "}
                    {i.status === "confirmed" ? "Confirmado" : "Estimado"}
                  </p>
                </div>
                <p className="text-on-surface-variant font-mono text-sm">
                  {Number(i.amount).toFixed(2)} {i.currency}
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
