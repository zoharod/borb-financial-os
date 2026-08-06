"use client";

import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { Modal } from "@/components/ui/modal";
import { Input, Select, Label } from "@/components/ui/input";
import { useCurrentHousehold } from "@/lib/hooks/use-current-household";
import { useAccounts, useCreateAccount } from "@/lib/hooks/use-accounts";
import { useAccountBalances } from "@/lib/hooks/use-account-balances";
import { useCards, useCreateCard, useUpdateCard, type Card as CardRow } from "@/lib/hooks/use-cards";
import { useCreateTransaction } from "@/lib/hooks/use-transactions";
import { useHouseholdMembers } from "@/lib/hooks/use-household-members";
import { CARD_NETWORKS } from "@/lib/constants";
import { todayISO, nextOccurrenceOfDay } from "@/lib/date";

type HouseholdRow = { base_currency_default: string; secondary_currency: string | null };

function paymentStatus(dueDate: string | null, balance: number, today: string) {
  if (balance <= 0) return { label: "Al día", tone: "text-secondary" };
  if (!dueDate) return { label: "Sin fecha de pago cargada", tone: "text-on-surface-variant" };
  if (dueDate < today) return { label: "Vencido", tone: "text-error" };
  const daysLeft = Math.round(
    (new Date(dueDate).getTime() - new Date(today).getTime()) / 86_400_000,
  );
  if (daysLeft <= 5) return { label: `Vence en ${daysLeft} día${daysLeft === 1 ? "" : "s"}`, tone: "text-tertiary" };
  return { label: "Al día", tone: "text-secondary" };
}

export default function CardsPage() {
  const { data: household } = useCurrentHousehold();
  const { data: accounts } = useAccounts();
  const { data: balances } = useAccountBalances();
  const { data: cards, isLoading } = useCards();
  const { data: members } = useHouseholdMembers();
  const [addOpen, setAddOpen] = useState(false);
  const [editing, setEditing] = useState<CardRow | null>(null);

  const householdRow = household?.households as unknown as HouseholdRow | null;
  const today = todayISO();

  return (
    <div className="max-w-4xl">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-on-surface tracking-tight flex items-center gap-2">
          <Icon name="credit_card" className="text-primary" filled />
          Tarjetas de crédito
        </h1>
        <Button onClick={() => setAddOpen(true)}>
          <Icon name="add" size={18} /> Agregar tarjeta
        </Button>
      </div>

      {isLoading ? (
        <p className="text-on-surface-variant text-sm">Cargando...</p>
      ) : !cards || cards.length === 0 ? (
        <p className="text-on-surface-variant text-sm">
          Todavía no agregaste ninguna tarjeta.
        </p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {cards.map((c) => {
            const cardAccounts = (accounts ?? []).filter((a) => a.card_id === c.id);
            const cardholder = members?.find((m) => m.user_id === c.cardholder_user_id);
            const dueDate = c.payment_due_day ? nextOccurrenceOfDay(c.payment_due_day) : null;
            const closingDate = c.statement_closing_day
              ? nextOccurrenceOfDay(c.statement_closing_day)
              : null;

            return (
              <Card key={c.id} className="flex flex-col gap-3">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-on-surface font-medium">{c.name}</p>
                    <p className="text-on-surface-variant text-xs">
                      {c.bank ?? "Sin banco"} ·{" "}
                      {CARD_NETWORKS.find((n) => n.value === c.network)?.label ?? c.network}
                      {c.last4 ? ` · •••• ${c.last4}` : ""}
                    </p>
                    <p className="text-on-surface-variant text-xs">
                      Tarjetahabiente:{" "}
                      {cardholder?.profiles?.full_name ?? c.legacy_cardholder_name ?? "Sin asignar"}
                    </p>
                  </div>
                  <Button variant="tertiary" onClick={() => setEditing(c)}>
                    Editar
                  </Button>
                </div>

                <div className="border-t border-outline-variant/20 pt-3 space-y-2">
                  {cardAccounts.length === 0 ? (
                    <p className="text-on-surface-variant text-xs">
                      Sin saldo cargado todavía.
                    </p>
                  ) : (
                    cardAccounts.map((a) => {
                      const bal = balances?.[a.id] ?? 0;
                      const owed = Math.max(0, -bal);
                      const status = paymentStatus(dueDate, owed, today);
                      return (
                        <div key={a.id} className="flex items-center justify-between">
                          <div>
                            <p className="font-mono text-sm text-on-surface">
                              {owed.toFixed(2)} {a.currency}
                              <span className="text-on-surface-variant text-xs ml-1">
                                {bal < 0 ? "deuda actual" : "a favor"}
                              </span>
                            </p>
                            <p className={`text-xs ${status.tone}`}>{status.label}</p>
                          </div>
                          <ReconcileCardBalance
                            account={a}
                            householdId={household?.household_id}
                            currentOwed={owed}
                          />
                        </div>
                      );
                    })
                  )}
                </div>

                <div className="border-t border-outline-variant/20 pt-3 grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-on-surface-variant">
                  <p>Pago mínimo: {c.minimum_payment != null ? c.minimum_payment.toFixed(2) : "—"}</p>
                  <p>Pago de contado: {c.full_payment_amount != null ? c.full_payment_amount.toFixed(2) : "—"}</p>
                  <p>Día de corte: {c.statement_closing_day ?? "—"}{closingDate ? ` (${closingDate})` : ""}</p>
                  <p>Día de pago: {c.payment_due_day ?? "—"}{dueDate ? ` (${dueDate})` : ""}</p>
                  <p>Límite: {c.credit_limit != null ? c.credit_limit.toFixed(2) : "—"}</p>
                  <p>Cashback: Próximamente</p>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {addOpen && (
        <Modal title="Agregar tarjeta" onClose={() => setAddOpen(false)}>
          <CardFormCreate
            householdId={household?.household_id}
            primaryCurrency={householdRow?.base_currency_default ?? "HNL"}
            secondaryCurrency={householdRow?.secondary_currency ?? null}
            onDone={() => setAddOpen(false)}
          />
        </Modal>
      )}

      {editing && (
        <Modal title={`Editar ${editing.name}`} onClose={() => setEditing(null)}>
          <CardFormEdit card={editing} onDone={() => setEditing(null)} />
        </Modal>
      )}
    </div>
  );
}

function ReconcileCardBalance({
  account,
  householdId,
  currentOwed,
}: {
  account: { id: string; currency: string };
  householdId: string | undefined;
  currentOwed: number;
}) {
  const [open, setOpen] = useState(false);
  const [realOwed, setRealOwed] = useState("");
  const createTransaction = useCreateTransaction();

  if (!open) {
    return (
      <Button variant="tertiary" onClick={() => setOpen(true)}>
        Corregir
      </Button>
    );
  }

  const diff = realOwed !== "" ? Number(realOwed) - currentOwed : null;

  async function handleReconcile() {
    if (!householdId || diff === null || diff === 0) return;
    await createTransaction.mutateAsync({
      household_id: householdId,
      account_id: account.id,
      to_account_id: null,
      category_id: null,
      type: "adjustment",
      // deuda sube = saldo de la cuenta baja (más negativo) -> signo invertido.
      amount: -diff,
      currency: account.currency,
      description: "Conciliación de saldo de tarjeta",
      transaction_date: todayISO(),
      reconciled_at: new Date().toISOString(),
    });
    setOpen(false);
    setRealOwed("");
  }

  return (
    <div className="flex items-center gap-2">
      <Input
        type="number"
        step="0.01"
        placeholder="Deuda real"
        value={realOwed}
        onChange={(e) => setRealOwed(e.target.value)}
        className="w-28"
      />
      <Button
        variant="secondary"
        onClick={handleReconcile}
        disabled={diff === null || diff === 0 || createTransaction.isPending}
      >
        Ajustar
      </Button>
    </div>
  );
}

function CardFormCreate({
  householdId,
  primaryCurrency,
  secondaryCurrency,
  onDone,
}: {
  householdId: string | undefined;
  primaryCurrency: string;
  secondaryCurrency: string | null;
  onDone: () => void;
}) {
  const createCard = useCreateCard();
  const createAccount = useCreateAccount();
  const createTransaction = useCreateTransaction();
  const { data: members } = useHouseholdMembers();

  const [name, setName] = useState("");
  const [bank, setBank] = useState("");
  const [cardholderUserId, setCardholderUserId] = useState("");
  const [network, setNetwork] = useState<(typeof CARD_NETWORKS)[number]["value"]>("visa");
  const [last4, setLast4] = useState("");
  const [creditLimit, setCreditLimit] = useState("");
  const [balancePrimary, setBalancePrimary] = useState("");
  const [balanceSecondary, setBalanceSecondary] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function seedAccount(cardId: string, currency: string, rawBalance: string) {
    if (!householdId) return;
    const account = await createAccount.mutateAsync({
      household_id: householdId,
      name: `${name} (${currency})`,
      type: "credit_card",
      currency,
      card_id: cardId,
    });
    const owed = Number(rawBalance);
    if (rawBalance !== "" && !Number.isNaN(owed) && owed !== 0) {
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

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!householdId) return;
    setError(null);
    try {
      const card = await createCard.mutateAsync({
        household_id: householdId,
        name,
        bank: bank || null,
        cardholder_user_id: cardholderUserId || null,
        network,
        last4: last4 || null,
        credit_limit: creditLimit ? Number(creditLimit) : null,
      });
      await seedAccount(card.id, primaryCurrency, balancePrimary);
      if (secondaryCurrency && balanceSecondary !== "") {
        await seedAccount(card.id, secondaryCurrency, balanceSecondary);
      }
      onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al crear la tarjeta");
    }
  }

  const isSaving = createCard.isPending || createAccount.isPending || createTransaction.isPending;

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div>
        <Label>Nombre de la tarjeta</Label>
        <Input required value={name} onChange={(e) => setName(e.target.value)} />
      </div>
      <div className="flex gap-4">
        <div className="flex-1">
          <Label>Banco</Label>
          <Input value={bank} onChange={(e) => setBank(e.target.value)} />
        </div>
        <div className="flex-1">
          <Label>Red</Label>
          <Select value={network} onChange={(e) => setNetwork(e.target.value as (typeof CARD_NETWORKS)[number]["value"])}>
            {CARD_NETWORKS.map((n) => (
              <option key={n.value} value={n.value}>{n.label}</option>
            ))}
          </Select>
        </div>
      </div>
      <div className="flex gap-4">
        <div className="flex-1">
          <Label>Tarjetahabiente</Label>
          <Select value={cardholderUserId} onChange={(e) => setCardholderUserId(e.target.value)}>
            <option value="">Sin asignar</option>
            {members?.map((m) => (
              <option key={m.user_id} value={m.user_id}>{m.profiles?.full_name || "Sin nombre"}</option>
            ))}
          </Select>
        </div>
        <div className="w-28">
          <Label>Últimos 4</Label>
          <Input maxLength={4} value={last4} onChange={(e) => setLast4(e.target.value)} />
        </div>
      </div>
      <div className="flex gap-4">
        <div className="flex-1">
          <Label>Saldo actual en {primaryCurrency} (deuda)</Label>
          <Input type="number" step="0.01" value={balancePrimary} onChange={(e) => setBalancePrimary(e.target.value)} placeholder="0.00" />
        </div>
        {secondaryCurrency && (
          <div className="flex-1">
            <Label>Saldo actual en {secondaryCurrency} (opcional)</Label>
            <Input type="number" step="0.01" value={balanceSecondary} onChange={(e) => setBalanceSecondary(e.target.value)} placeholder="0.00" />
          </div>
        )}
        <div className="flex-1">
          <Label>Límite (opcional)</Label>
          <Input type="number" step="0.01" value={creditLimit} onChange={(e) => setCreditLimit(e.target.value)} />
        </div>
      </div>
      {error && <p className="text-sm text-error" role="alert">{error}</p>}
      <Button type="submit" disabled={isSaving}>{isSaving ? "Agregando..." : "Agregar tarjeta"}</Button>
    </form>
  );
}

function CardFormEdit({ card, onDone }: { card: CardRow; onDone: () => void }) {
  const updateCard = useUpdateCard();
  const { data: members } = useHouseholdMembers();

  const [bank, setBank] = useState(card.bank ?? "");
  const [cardholderUserId, setCardholderUserId] = useState(card.cardholder_user_id ?? "");
  const [last4, setLast4] = useState(card.last4 ?? "");
  const [creditLimit, setCreditLimit] = useState(card.credit_limit != null ? String(card.credit_limit) : "");
  const [statementClosingDay, setStatementClosingDay] = useState(
    card.statement_closing_day != null ? String(card.statement_closing_day) : "",
  );
  const [paymentDueDay, setPaymentDueDay] = useState(
    card.payment_due_day != null ? String(card.payment_due_day) : "",
  );
  const [minimumPayment, setMinimumPayment] = useState(
    card.minimum_payment != null ? String(card.minimum_payment) : "",
  );
  const [fullPaymentAmount, setFullPaymentAmount] = useState(
    card.full_payment_amount != null ? String(card.full_payment_amount) : "",
  );
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await updateCard.mutateAsync({
        id: card.id,
        bank: bank || null,
        cardholder_user_id: cardholderUserId || null,
        last4: last4 || null,
        credit_limit: creditLimit ? Number(creditLimit) : null,
        statement_closing_day: statementClosingDay ? Number(statementClosingDay) : null,
        payment_due_day: paymentDueDay ? Number(paymentDueDay) : null,
        minimum_payment: minimumPayment ? Number(minimumPayment) : null,
        full_payment_amount: fullPaymentAmount ? Number(fullPaymentAmount) : null,
      });
      onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al actualizar la tarjeta");
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div className="flex gap-4">
        <div className="flex-1">
          <Label>Banco</Label>
          <Input value={bank} onChange={(e) => setBank(e.target.value)} />
        </div>
        <div className="w-28">
          <Label>Últimos 4</Label>
          <Input maxLength={4} value={last4} onChange={(e) => setLast4(e.target.value)} />
        </div>
      </div>
      <div>
        <Label>Tarjetahabiente</Label>
        <Select value={cardholderUserId} onChange={(e) => setCardholderUserId(e.target.value)}>
          <option value="">Sin asignar</option>
          {members?.map((m) => (
            <option key={m.user_id} value={m.user_id}>{m.profiles?.full_name || "Sin nombre"}</option>
          ))}
        </Select>
      </div>
      <div className="flex gap-4">
        <div className="flex-1">
          <Label>Día de corte</Label>
          <Input type="number" min="1" max="31" value={statementClosingDay} onChange={(e) => setStatementClosingDay(e.target.value)} />
        </div>
        <div className="flex-1">
          <Label>Día de pago</Label>
          <Input type="number" min="1" max="31" value={paymentDueDay} onChange={(e) => setPaymentDueDay(e.target.value)} />
        </div>
      </div>
      <div className="flex gap-4">
        <div className="flex-1">
          <Label>Pago mínimo</Label>
          <Input type="number" step="0.01" value={minimumPayment} onChange={(e) => setMinimumPayment(e.target.value)} />
        </div>
        <div className="flex-1">
          <Label>Pago de contado</Label>
          <Input type="number" step="0.01" value={fullPaymentAmount} onChange={(e) => setFullPaymentAmount(e.target.value)} />
        </div>
        <div className="flex-1">
          <Label>Límite</Label>
          <Input type="number" step="0.01" value={creditLimit} onChange={(e) => setCreditLimit(e.target.value)} />
        </div>
      </div>
      {error && <p className="text-sm text-error" role="alert">{error}</p>}
      <Button type="submit" disabled={updateCard.isPending}>{updateCard.isPending ? "Guardando..." : "Guardar"}</Button>
    </form>
  );
}
