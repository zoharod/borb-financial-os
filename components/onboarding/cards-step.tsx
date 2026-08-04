"use client";

import { useState } from "react";
import { StepShell } from "./step-shell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input, Select, Label } from "@/components/ui/input";
import { useCurrentHousehold } from "@/lib/hooks/use-current-household";
import { useCards, useCreateCard } from "@/lib/hooks/use-cards";
import { useCreateAccount } from "@/lib/hooks/use-accounts";
import { useCreateTransaction } from "@/lib/hooks/use-transactions";
import { CARD_NETWORKS } from "@/lib/constants";
import { todayISO } from "@/lib/date";

type HouseholdRow = { base_currency_default: string; secondary_currency: string | null };

function getHouseholdRow(
  household: ReturnType<typeof useCurrentHousehold>["data"],
): HouseholdRow | null {
  if (!household) return null;
  return household.households as unknown as HouseholdRow | null;
}

export function CardsStep({
  householdId,
  onBack,
  onContinue,
}: {
  householdId: string;
  onBack?: () => void;
  onContinue: () => void;
}) {
  const { data: household } = useCurrentHousehold();
  const { data: cards } = useCards();
  const createCard = useCreateCard();
  const createAccount = useCreateAccount();
  const createTransaction = useCreateTransaction();

  const householdRow = getHouseholdRow(household);
  const primaryCurrency = householdRow?.base_currency_default ?? "HNL";
  const secondaryCurrency = householdRow?.secondary_currency ?? null;

  const [name, setName] = useState("");
  const [bank, setBank] = useState("");
  const [cardholder, setCardholder] = useState("");
  const [network, setNetwork] =
    useState<(typeof CARD_NETWORKS)[number]["value"]>("visa");
  const [last4, setLast4] = useState("");
  const [creditLimit, setCreditLimit] = useState("");
  const [statementClosingDay, setStatementClosingDay] = useState("");
  const [paymentDueDay, setPaymentDueDay] = useState("");
  const [balancePrimary, setBalancePrimary] = useState("");
  const [balanceSecondary, setBalanceSecondary] = useState("");
  const [minimumPayment, setMinimumPayment] = useState("");
  const [fullPaymentAmount, setFullPaymentAmount] = useState("");
  const [uploadNotice, setUploadNotice] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function resetForm() {
    setName("");
    setBank("");
    setCardholder("");
    setLast4("");
    setCreditLimit("");
    setStatementClosingDay("");
    setPaymentDueDay("");
    setBalancePrimary("");
    setBalanceSecondary("");
    setMinimumPayment("");
    setFullPaymentAmount("");
  }

  async function createCardAccount(
    cardId: string,
    cardName: string,
    currency: string,
    rawBalance: string,
  ) {
    const account = await createAccount.mutateAsync({
      household_id: householdId,
      name: `${cardName} (${currency})`,
      type: "credit_card",
      currency,
      card_id: cardId,
    });

    const owed = Number(rawBalance);
    if (account && rawBalance !== "" && !Number.isNaN(owed) && owed !== 0) {
      // Convención: el usuario ingresa "cuánto debés" como número positivo;
      // se guarda negativo porque en una cuenta credit_card saldo negativo
      // = deuda (ver domain.md).
      await createTransaction.mutateAsync({
        household_id: householdId,
        account_id: account.id,
        to_account_id: null,
        category_id: null,
        type: "adjustment",
        amount: -owed,
        currency,
        description: "Saldo inicial (deuda)",
        transaction_date: todayISO(),
      });
    }
  }

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    try {
      const card = await createCard.mutateAsync({
        household_id: householdId,
        name,
        bank: bank || null,
        cardholder: cardholder || null,
        network,
        last4: last4 || null,
        credit_limit: creditLimit ? Number(creditLimit) : null,
        statement_closing_day: statementClosingDay
          ? Number(statementClosingDay)
          : null,
        payment_due_day: paymentDueDay ? Number(paymentDueDay) : null,
        minimum_payment: minimumPayment ? Number(minimumPayment) : null,
        full_payment_amount: fullPaymentAmount
          ? Number(fullPaymentAmount)
          : null,
      });

      await createCardAccount(card.id, name, primaryCurrency, balancePrimary);

      if (secondaryCurrency && balanceSecondary !== "") {
        await createCardAccount(
          card.id,
          name,
          secondaryCurrency,
          balanceSecondary,
        );
      }

      resetForm();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al crear la tarjeta");
    }
  }

  const isSaving =
    createCard.isPending || createAccount.isPending || createTransaction.isPending;

  return (
    <StepShell
      step={3}
      total={5}
      title="Agregá tus tarjetas de crédito"
      description="Es opcional — si no usás tarjetas todavía, tocá Continuar sin agregar ninguna."
      onBack={onBack}
      wide
    >
      <Card className="mb-6">
        <p className="text-sm text-on-surface-variant mb-2">
          Subir tu último estado de cuenta
        </p>
        <input
          type="file"
          accept=".pdf,image/*"
          onChange={() => setUploadNotice(true)}
          className="block w-full text-sm text-on-surface-variant file:mr-4 file:rounded-full file:border-0 file:bg-surface-container-high file:px-4 file:py-2 file:text-on-surface"
        />
        {uploadNotice && (
          <p className="text-xs text-on-surface-variant mt-2">
            La extracción automática de estados de cuenta todavía no está
            disponible — completá los datos manualmente abajo por ahora.
          </p>
        )}
      </Card>

      <form onSubmit={handleAdd} className="flex flex-col gap-4 mb-6">
        <div className="flex gap-4">
          <div className="flex-1">
            <Label>Nombre de la tarjeta</Label>
            <Input
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Visa Signature, ..."
            />
          </div>
          <div className="flex-1">
            <Label>Banco</Label>
            <Input value={bank} onChange={(e) => setBank(e.target.value)} />
          </div>
        </div>

        <div className="flex gap-4">
          <div className="flex-1">
            <Label>Tarjetahabiente</Label>
            <Input
              value={cardholder}
              onChange={(e) => setCardholder(e.target.value)}
            />
          </div>
          <div className="flex-1">
            <Label>Red</Label>
            <Select
              value={network}
              onChange={(e) =>
                setNetwork(e.target.value as (typeof CARD_NETWORKS)[number]["value"])
              }
            >
              {CARD_NETWORKS.map((n) => (
                <option key={n.value} value={n.value}>
                  {n.label}
                </option>
              ))}
            </Select>
          </div>
          <div className="w-28">
            <Label>Últimos 4</Label>
            <Input
              maxLength={4}
              value={last4}
              onChange={(e) => setLast4(e.target.value)}
            />
          </div>
        </div>

        <div className="flex gap-4">
          <div className="flex-1">
            <Label>Saldo actual en {primaryCurrency} (lo que debés)</Label>
            <Input
              type="number"
              step="0.01"
              value={balancePrimary}
              onChange={(e) => setBalancePrimary(e.target.value)}
              placeholder="0.00"
            />
          </div>
          {secondaryCurrency && (
            <div className="flex-1">
              <Label>Saldo actual en {secondaryCurrency} (opcional)</Label>
              <Input
                type="number"
                step="0.01"
                value={balanceSecondary}
                onChange={(e) => setBalanceSecondary(e.target.value)}
                placeholder="0.00"
              />
            </div>
          )}
          <div className="flex-1">
            <Label>Límite de crédito (opcional)</Label>
            <Input
              type="number"
              step="0.01"
              value={creditLimit}
              onChange={(e) => setCreditLimit(e.target.value)}
            />
          </div>
        </div>

        <div className="flex gap-4">
          <div className="flex-1">
            <Label>Día de corte (opcional)</Label>
            <Input
              type="number"
              min="1"
              max="31"
              value={statementClosingDay}
              onChange={(e) => setStatementClosingDay(e.target.value)}
            />
          </div>
          <div className="flex-1">
            <Label>Día de pago (opcional)</Label>
            <Input
              type="number"
              min="1"
              max="31"
              value={paymentDueDay}
              onChange={(e) => setPaymentDueDay(e.target.value)}
            />
          </div>
          <div className="flex-1">
            <Label>Pago mínimo (opcional)</Label>
            <Input
              type="number"
              step="0.01"
              value={minimumPayment}
              onChange={(e) => setMinimumPayment(e.target.value)}
            />
          </div>
          <div className="flex-1">
            <Label>Pago de contado (opcional)</Label>
            <Input
              type="number"
              step="0.01"
              value={fullPaymentAmount}
              onChange={(e) => setFullPaymentAmount(e.target.value)}
            />
          </div>
        </div>

        {error && (
          <p className="text-sm text-error" role="alert">
            {error}
          </p>
        )}

        <Button type="submit" variant="secondary" disabled={isSaving}>
          {isSaving ? "Agregando..." : "Agregar tarjeta"}
        </Button>
      </form>

      {cards && cards.length > 0 && (
        <ul className="space-y-2 mb-6">
          {cards.map((c) => (
            <li key={c.id}>
              <Card className="py-3">
                <p className="text-on-surface font-medium">{c.name}</p>
                <p className="text-on-surface-variant text-xs font-mono">
                  {c.bank ?? "Sin banco"} ·{" "}
                  {CARD_NETWORKS.find((n) => n.value === c.network)?.label ??
                    c.network}
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
