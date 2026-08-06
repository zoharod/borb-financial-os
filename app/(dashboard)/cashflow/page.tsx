"use client";

import { useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { Input, Select, Label } from "@/components/ui/input";
import { useCurrentHousehold } from "@/lib/hooks/use-current-household";
import { useAccounts } from "@/lib/hooks/use-accounts";
import { useHouseholdMembers } from "@/lib/hooks/use-household-members";
import { useCards } from "@/lib/hooks/use-cards";
import { useDashboardSummary, currentMonthISO } from "@/lib/hooks/use-dashboard-summary";
import {
  useCommitments,
  useCreateCommitment,
  useDeleteCommitment,
  useUpdateCommitment,
} from "@/lib/hooks/use-commitments";
import {
  useExpectedIncome,
  useCreateExpectedIncome,
  useDeleteExpectedIncome,
  useUpdateExpectedIncome,
} from "@/lib/hooks/use-expected-income";
import { useCreateTransaction } from "@/lib/hooks/use-transactions";
import { CURRENCIES } from "@/lib/constants";
import { todayISO, nextOccurrenceOfDay, advanceDate } from "@/lib/date";

const FREQUENCIES = [
  { value: "monthly", label: "Mensual" },
  { value: "biweekly", label: "Quincenal" },
  { value: "weekly", label: "Semanal" },
  { value: "one_time", label: "Una vez" },
] as const;

function fmt(n: number) {
  return n.toLocaleString("es-HN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function defaultHorizon() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate(),
  ).padStart(2, "0")}`;
}

type UpcomingEvent = {
  date: string;
  label: string;
  amount: number;
  currency: string;
  kind: "income" | "commitment" | "card";
  sourceId: string;
};

export default function CashFlowPage() {
  const { data: household } = useCurrentHousehold();
  const householdRow = household?.households as unknown as { base_currency_default: string } | null;
  const primaryCurrency = householdRow?.base_currency_default ?? "HNL";
  const today = todayISO();

  const [horizon, setHorizon] = useState(defaultHorizon());
  const { data: accounts } = useAccounts();
  const { data: cards } = useCards();
  const { data: members } = useHouseholdMembers();
  const { data: commitments } = useCommitments();
  const { data: incomes } = useExpectedIncome();
  const { data: summary } = useDashboardSummary(currentMonthISO(), primaryCurrency);

  const createTransaction = useCreateTransaction();
  const updateCommitment = useUpdateCommitment();
  const deleteCommitment = useDeleteCommitment();
  const updateIncome = useUpdateExpectedIncome();
  const deleteIncome = useDeleteExpectedIncome();

  const accountsByCard = useMemo(() => {
    const map = new Map<string, string[]>();
    for (const a of accounts ?? []) {
      if (!a.card_id) continue;
      map.set(a.card_id, [...(map.get(a.card_id) ?? []), a.id]);
    }
    return map;
  }, [accounts]);

  // Todos los eventos futuros dentro del horizonte elegido — no solo "este
  // mes" como en el Dashboard, para poder responder "¿cuánto tendré el 15 de
  // agosto?" con cualquier fecha, no solo fin de mes actual.
  const events = useMemo<UpcomingEvent[]>(() => {
    const list: UpcomingEvent[] = [];
    for (const i of incomes ?? []) {
      if (i.status === "confirmed") continue;
      if (i.expected_date < today || i.expected_date > horizon) continue;
      list.push({ date: i.expected_date, label: `Ingreso: ${i.source}`, amount: Number(i.amount), currency: i.currency, kind: "income", sourceId: i.id });
    }
    for (const c of commitments ?? []) {
      if (c.status !== "active" || !c.next_payment_date) continue;
      if (c.next_payment_date < today || c.next_payment_date > horizon) continue;
      list.push({ date: c.next_payment_date, label: c.name, amount: Number(c.amount), currency: c.currency, kind: "commitment", sourceId: c.id });
    }
    for (const card of cards ?? []) {
      if (!card.payment_due_day) continue;
      const amountDue = card.full_payment_amount ?? card.minimum_payment;
      if (!amountDue) continue;
      const dueDate = nextOccurrenceOfDay(card.payment_due_day);
      if (dueDate < today || dueDate > horizon) continue;
      const linkedAccounts = accountsByCard.get(card.id) ?? [];
      const currency = linkedAccounts.length === 1 ? (accounts?.find((a) => a.id === linkedAccounts[0])?.currency ?? primaryCurrency) : primaryCurrency;
      list.push({ date: dueDate, label: `Tarjeta: ${card.name}`, amount: Number(amountDue), currency, kind: "card", sourceId: card.id });
    }
    return list.sort((a, b) => a.date.localeCompare(b.date));
  }, [incomes, commitments, cards, accountsByCard, accounts, today, horizon, primaryCurrency]);

  // Saldo proyectado corriendo por moneda: arranca en liquidBalance (solo
  // transacciones confirmadas/conciliadas, ver use-dashboard-summary.ts) y
  // aplica cada evento en orden cronológico.
  const currencies = useMemo(
    () => Array.from(new Set([...Object.keys(summary?.liquidBalance ?? {}), ...events.map((e) => e.currency)])),
    [summary, events],
  );

  const projectedByCurrency = useMemo(() => {
    const running: Record<string, number> = {};
    for (const c of currencies) running[c] = summary?.liquidBalance?.[c] ?? 0;
    for (const e of events) {
      running[e.currency] = (running[e.currency] ?? 0) + (e.kind === "income" ? e.amount : -e.amount);
    }
    return running;
  }, [currencies, events, summary]);

  async function markCommitmentPaid(commitment: NonNullable<typeof commitments>[number]) {
    if (!household || !commitment.account_id) {
      alert("Esta obligación no tiene una cuenta de pago asignada — editala primero.");
      return;
    }
    await createTransaction.mutateAsync({
      household_id: household.household_id,
      account_id: commitment.account_id,
      to_account_id: null,
      category_id: commitment.category_id,
      commitment_id: commitment.id,
      type: "financing_installment",
      amount: Number(commitment.amount),
      currency: commitment.currency,
      description: commitment.name,
      transaction_date: today,
      status: "confirmed",
    });
    const remaining = commitment.remaining_installments != null ? commitment.remaining_installments - 1 : null;
    const nextDate = commitment.next_payment_date ? advanceDate(commitment.next_payment_date, commitment.frequency) : null;
    await updateCommitment.mutateAsync({
      id: commitment.id,
      remaining_installments: remaining,
      next_payment_date: remaining === 0 ? null : nextDate,
      status: remaining === 0 || nextDate === null ? "completed" : "active",
    });
  }

  async function confirmIncome(income: NonNullable<typeof incomes>[number]) {
    if (!household || !income.destination_account_id) {
      alert("Este ingreso no tiene una cuenta destino asignada — editalo primero.");
      return;
    }
    await createTransaction.mutateAsync({
      household_id: household.household_id,
      account_id: income.destination_account_id,
      to_account_id: null,
      category_id: null,
      type: "income",
      amount: Number(income.amount),
      currency: income.currency,
      description: income.source,
      transaction_date: today,
      status: "confirmed",
      created_by: income.household_member_user_id ?? undefined,
    });
    await updateIncome.mutateAsync({ id: income.id, status: "confirmed" });
  }

  return (
    <div className="max-w-3xl">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-on-surface tracking-tight flex items-center gap-2">
          <Icon name="timeline" className="text-primary" filled />
          Flujo de caja
        </h1>
        <div className="flex items-center gap-2">
          <Label>Proyectar hasta</Label>
          <div className="w-40">
            <Input type="date" value={horizon} onChange={(e) => setHorizon(e.target.value)} />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        {currencies.map((c) => (
          <div key={c} className="col-span-2 md:col-span-4 grid grid-cols-2 md:grid-cols-4 gap-3">
            <Card>
              <p className="text-xs text-on-surface-variant">Disponible ahora ({c})</p>
              <p className="text-xl font-bold text-on-surface font-mono">{fmt(summary?.liquidBalance?.[c] ?? 0)}</p>
            </Card>
            <Card>
              <p className="text-xs text-on-surface-variant">Comprometido hasta {horizon}</p>
              <p className="text-xl font-bold text-error font-mono">
                {fmt(events.filter((e) => e.currency === c && e.kind !== "income").reduce((s, e) => s + e.amount, 0))}
              </p>
            </Card>
            <Card>
              <p className="text-xs text-on-surface-variant">Ingreso esperado hasta {horizon}</p>
              <p className="text-xl font-bold text-secondary font-mono">
                {fmt(events.filter((e) => e.currency === c && e.kind === "income").reduce((s, e) => s + e.amount, 0))}
              </p>
            </Card>
            <Card>
              <p className="text-xs text-on-surface-variant">Proyectado al {horizon}</p>
              <p className={`text-xl font-bold font-mono ${projectedByCurrency[c] < 0 ? "text-error" : "text-on-surface"}`}>
                {fmt(projectedByCurrency[c] ?? 0)}
              </p>
            </Card>
          </div>
        ))}
      </div>

      <Card className="mb-6">
        <p className="font-mono text-xs uppercase tracking-wider text-on-surface-variant mb-3">
          Línea de tiempo (más próximo primero)
        </p>
        {events.length === 0 ? (
          <p className="text-on-surface-variant text-sm">Nada programado en este horizonte.</p>
        ) : (
          <ul className="space-y-2">
            {events.map((e) => (
              <li key={`${e.kind}-${e.sourceId}-${e.date}`} className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2">
                  <Icon
                    name={e.kind === "income" ? "trending_up" : e.kind === "card" ? "credit_card" : "event_repeat"}
                    size={18}
                    className={e.kind === "income" ? "text-secondary" : "text-on-surface-variant"}
                  />
                  <span className="text-on-surface">{e.label}</span>
                  <span className="text-on-surface-variant text-xs">{e.date}</span>
                </div>
                <span className={`font-mono ${e.kind === "income" ? "text-secondary" : "text-on-surface"}`}>
                  {e.kind === "income" ? "+" : "-"}{fmt(e.amount)} {e.currency}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <CommitmentsPanel
          householdId={household?.household_id}
          commitments={commitments ?? []}
          accounts={accounts ?? []}
          onMarkPaid={markCommitmentPaid}
          onDelete={(id) => deleteCommitment.mutate(id)}
          isMarking={createTransaction.isPending || updateCommitment.isPending}
        />
        <IncomePanel
          householdId={household?.household_id}
          incomes={incomes ?? []}
          accounts={accounts ?? []}
          members={members ?? []}
          onConfirm={confirmIncome}
          onDelete={(id) => deleteIncome.mutate(id)}
          isConfirming={createTransaction.isPending || updateIncome.isPending}
        />
      </div>
    </div>
  );
}

function CommitmentsPanel({
  householdId,
  commitments,
  accounts,
  onMarkPaid,
  onDelete,
  isMarking,
}: {
  householdId: string | undefined;
  commitments: NonNullable<ReturnType<typeof useCommitments>["data"]>;
  accounts: NonNullable<ReturnType<typeof useAccounts>["data"]>;
  onMarkPaid: (c: (typeof commitments)[number]) => void;
  onDelete: (id: string) => void;
  isMarking: boolean;
}) {
  const createCommitment = useCreateCommitment();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [amount, setAmount] = useState("");
  const [currency, setCurrency] = useState<(typeof CURRENCIES)[number]>("HNL");
  const [frequency, setFrequency] = useState<(typeof FREQUENCIES)[number]["value"]>("monthly");
  const [nextPaymentDate, setNextPaymentDate] = useState(todayISO());
  const [accountId, setAccountId] = useState("");
  const [remaining, setRemaining] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!householdId) return;
    await createCommitment.mutateAsync({
      household_id: householdId,
      name,
      amount: Number(amount),
      currency,
      start_date: todayISO(),
      frequency,
      next_payment_date: nextPaymentDate || null,
      remaining_installments: remaining ? Number(remaining) : null,
      account_id: accountId || null,
      category_id: null,
      status: "active",
    });
    setName("");
    setAmount("");
    setRemaining("");
    setOpen(false);
  }

  return (
    <Card>
      <div className="flex items-center justify-between mb-3">
        <p className="font-medium text-on-surface">Compromisos financieros</p>
        <Button variant="tertiary" onClick={() => setOpen((v) => !v)}>
          {open ? "Cancelar" : "+ Agregar"}
        </Button>
      </div>

      {open && (
        <form onSubmit={handleSubmit} className="flex flex-col gap-2 mb-3 pb-3 border-b border-outline-variant/20">
          <Input required placeholder="Nombre (ej. Cuota laptop)" value={name} onChange={(e) => setName(e.target.value)} />
          <div className="flex gap-2">
            <Input required type="number" step="0.01" placeholder="Monto" value={amount} onChange={(e) => setAmount(e.target.value)} />
            <Select value={currency} onChange={(e) => setCurrency(e.target.value as (typeof CURRENCIES)[number])} className="w-24">
              {CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </Select>
          </div>
          <div className="flex gap-2">
            <Select value={frequency} onChange={(e) => setFrequency(e.target.value as (typeof FREQUENCIES)[number]["value"])}>
              {FREQUENCIES.map((f) => <option key={f.value} value={f.value}>{f.label}</option>)}
            </Select>
            <Input type="date" value={nextPaymentDate} onChange={(e) => setNextPaymentDate(e.target.value)} />
          </div>
          <div className="flex gap-2">
            <Select value={accountId} onChange={(e) => setAccountId(e.target.value)}>
              <option value="">Cuenta de pago...</option>
              {accounts.filter((a) => a.type !== "credit_card").map((a) => (
                <option key={a.id} value={a.id}>{a.name}</option>
              ))}
            </Select>
            <Input type="number" placeholder="Cuotas restantes (opcional)" value={remaining} onChange={(e) => setRemaining(e.target.value)} />
          </div>
          <Button type="submit" disabled={createCommitment.isPending}>Guardar</Button>
        </form>
      )}

      {commitments.length === 0 ? (
        <p className="text-on-surface-variant text-sm">Ninguno agregado.</p>
      ) : (
        <ul className="space-y-2">
          {commitments.map((c) => (
            <li key={c.id} className="flex items-center justify-between text-sm">
              <div>
                <p className="text-on-surface">{c.name}</p>
                <p className="text-on-surface-variant text-xs">
                  {Number(c.amount).toFixed(2)} {c.currency} · {c.status === "active" ? (c.next_payment_date ?? "sin próxima fecha") : "completado"}
                  {c.remaining_installments != null ? ` · ${c.remaining_installments} cuotas restantes` : ""}
                </p>
              </div>
              <div className="flex gap-2">
                {c.status === "active" && (
                  <Button variant="secondary" onClick={() => onMarkPaid(c)} disabled={isMarking}>
                    Marcar pagado
                  </Button>
                )}
                <Button variant="danger" onClick={() => onDelete(c.id)}>Eliminar</Button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

function IncomePanel({
  householdId,
  incomes,
  accounts,
  members,
  onConfirm,
  onDelete,
  isConfirming,
}: {
  householdId: string | undefined;
  incomes: NonNullable<ReturnType<typeof useExpectedIncome>["data"]>;
  accounts: NonNullable<ReturnType<typeof useAccounts>["data"]>;
  members: NonNullable<ReturnType<typeof useHouseholdMembers>["data"]>;
  onConfirm: (i: (typeof incomes)[number]) => void;
  onDelete: (id: string) => void;
  isConfirming: boolean;
}) {
  const createIncome = useCreateExpectedIncome();
  const [open, setOpen] = useState(false);
  const [source, setSource] = useState("");
  const [amount, setAmount] = useState("");
  const [currency, setCurrency] = useState<(typeof CURRENCIES)[number]>("HNL");
  const [expectedDate, setExpectedDate] = useState(todayISO());
  const [frequency, setFrequency] = useState<(typeof FREQUENCIES)[number]["value"]>("monthly");
  const [destinationAccountId, setDestinationAccountId] = useState("");
  const [memberUserId, setMemberUserId] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!householdId) return;
    await createIncome.mutateAsync({
      household_id: householdId,
      source,
      amount: Number(amount),
      currency,
      expected_date: expectedDate,
      frequency,
      destination_account_id: destinationAccountId || null,
      household_member_user_id: memberUserId || null,
      status: "estimated",
    });
    setSource("");
    setAmount("");
    setOpen(false);
  }

  const pending = incomes.filter((i) => i.status !== "confirmed");

  return (
    <Card>
      <div className="flex items-center justify-between mb-3">
        <p className="font-medium text-on-surface">Ingreso esperado</p>
        <Button variant="tertiary" onClick={() => setOpen((v) => !v)}>
          {open ? "Cancelar" : "+ Agregar"}
        </Button>
      </div>

      {open && (
        <form onSubmit={handleSubmit} className="flex flex-col gap-2 mb-3 pb-3 border-b border-outline-variant/20">
          <Input required placeholder="Fuente (ej. Salario)" value={source} onChange={(e) => setSource(e.target.value)} />
          <div className="flex gap-2">
            <Input required type="number" step="0.01" placeholder="Monto" value={amount} onChange={(e) => setAmount(e.target.value)} />
            <Select value={currency} onChange={(e) => setCurrency(e.target.value as (typeof CURRENCIES)[number])} className="w-24">
              {CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </Select>
          </div>
          <div className="flex gap-2">
            <Input type="date" value={expectedDate} onChange={(e) => setExpectedDate(e.target.value)} />
            <Select value={frequency} onChange={(e) => setFrequency(e.target.value as (typeof FREQUENCIES)[number]["value"])}>
              {FREQUENCIES.map((f) => <option key={f.value} value={f.value}>{f.label}</option>)}
            </Select>
          </div>
          <div className="flex gap-2">
            <Select value={destinationAccountId} onChange={(e) => setDestinationAccountId(e.target.value)}>
              <option value="">Cuenta destino...</option>
              {accounts.filter((a) => a.type !== "credit_card").map((a) => (
                <option key={a.id} value={a.id}>{a.name}</option>
              ))}
            </Select>
            <Select value={memberUserId} onChange={(e) => setMemberUserId(e.target.value)}>
              <option value="">Miembro (opcional)</option>
              {members.map((m) => (
                <option key={m.user_id} value={m.user_id}>{m.profiles?.full_name || "Sin nombre"}</option>
              ))}
            </Select>
          </div>
          <Button type="submit" disabled={createIncome.isPending}>Guardar</Button>
        </form>
      )}

      {pending.length === 0 ? (
        <p className="text-on-surface-variant text-sm">Nada pendiente.</p>
      ) : (
        <ul className="space-y-2">
          {pending.map((i) => (
            <li key={i.id} className="flex items-center justify-between text-sm">
              <div>
                <p className="text-on-surface">{i.source}</p>
                <p className="text-on-surface-variant text-xs">
                  {Number(i.amount).toFixed(2)} {i.currency} · {i.expected_date}
                </p>
              </div>
              <div className="flex gap-2">
                <Button variant="secondary" onClick={() => onConfirm(i)} disabled={isConfirming}>
                  Confirmar recibido
                </Button>
                <Button variant="danger" onClick={() => onDelete(i.id)}>Eliminar</Button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
