"use client";

import { useState } from "react";
import { StepShell } from "./step-shell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input, Select, Label } from "@/components/ui/input";
import { useAccounts } from "@/lib/hooks/use-accounts";
import { useCategories } from "@/lib/hooks/use-categories";
import {
  useCommitments,
  useCreateCommitment,
} from "@/lib/hooks/use-commitments";
import { CURRENCIES } from "@/lib/constants";
import { todayISO } from "@/lib/date";

const FREQUENCIES = [
  { value: "monthly", label: "Mensual" },
  { value: "biweekly", label: "Quincenal" },
  { value: "weekly", label: "Semanal" },
  { value: "one_time", label: "Pago único" },
] as const;

export function CommitmentsStep({
  householdId,
  onBack,
  onContinue,
}: {
  householdId: string;
  onBack?: () => void;
  onContinue: () => void;
}) {
  const { data: accounts } = useAccounts();
  const { data: categories } = useCategories();
  const { data: commitments } = useCommitments();
  const createCommitment = useCreateCommitment();

  const [name, setName] = useState("");
  const [amount, setAmount] = useState("");
  const [currency, setCurrency] = useState<(typeof CURRENCIES)[number]>("HNL");
  const [startDate, setStartDate] = useState(todayISO());
  const [remainingInstallments, setRemainingInstallments] = useState("");
  const [frequency, setFrequency] =
    useState<(typeof FREQUENCIES)[number]["value"]>("monthly");
  const [nextPaymentDate, setNextPaymentDate] = useState(todayISO());
  const [accountId, setAccountId] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [error, setError] = useState<string | null>(null);

  function resetForm() {
    setName("");
    setAmount("");
    setRemainingInstallments("");
    setNextPaymentDate(todayISO());
    setAccountId("");
    setCategoryId("");
  }

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await createCommitment.mutateAsync({
        household_id: householdId,
        name,
        amount: Number(amount),
        currency,
        start_date: startDate,
        remaining_installments: remainingInstallments
          ? Number(remainingInstallments)
          : null,
        frequency,
        next_payment_date: nextPaymentDate || null,
        account_id: accountId || null,
        category_id: categoryId || null,
        status: "active",
      });
      resetForm();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Error al guardar el compromiso",
      );
    }
  }

  return (
    <StepShell
      step={5}
      total={7}
      title="Cuotas y compromisos financieros"
      description="Financiamientos, minicuotas, préstamos o pagos recurrentes que ya tenés comprometidos. Es opcional — no son gastos nuevos, son plata que ya sabés que vas a pagar."
      onBack={onBack}
      wide
    >
      <form onSubmit={handleAdd} className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-4 mb-6">
        <div>
          <Label>Nombre</Label>
          <Input
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Cuota del celular, préstamo del carro, ..."
          />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label>Monto de la cuota</Label>
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
          <Label>Cuotas restantes (opcional)</Label>
          <Input
            type="number"
            min="0"
            value={remainingInstallments}
            onChange={(e) => setRemainingInstallments(e.target.value)}
            placeholder="Dejalo vacío si no lo sabés"
          />
        </div>

        <div>
          <Label>Fecha de inicio</Label>
          <Input
            type="date"
            required
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
          />
        </div>
        <div>
          <Label>Próxima fecha de pago</Label>
          <Input
            type="date"
            value={nextPaymentDate}
            onChange={(e) => setNextPaymentDate(e.target.value)}
          />
        </div>

        <div>
          <Label>Cuenta o tarjeta desde la que se paga (opcional)</Label>
          <Select value={accountId} onChange={(e) => setAccountId(e.target.value)}>
            <option value="">Sin especificar</option>
            {accounts?.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name} ({a.currency})
              </option>
            ))}
          </Select>
        </div>
        <div>
          <Label>Categoría (opcional)</Label>
          <Select value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
            <option value="">Sin categoría</option>
            {categories?.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>
        </div>

        {error && (
          <p className="text-sm text-error sm:col-span-2" role="alert">
            {error}
          </p>
        )}

        <Button
          type="submit"
          variant="secondary"
          disabled={createCommitment.isPending}
          className="sm:col-span-2"
        >
          {createCommitment.isPending ? "Agregando..." : "Agregar compromiso"}
        </Button>
      </form>

      {commitments && commitments.length > 0 && (
        <ul className="space-y-2 mb-6">
          {commitments.map((c) => (
            <li key={c.id}>
              <Card className="flex items-center justify-between py-3">
                <p className="text-on-surface">{c.name}</p>
                <p className="text-on-surface-variant font-mono text-sm">
                  {Number(c.amount).toFixed(2)} {c.currency} ·{" "}
                  {FREQUENCIES.find((f) => f.value === c.frequency)?.label}
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
