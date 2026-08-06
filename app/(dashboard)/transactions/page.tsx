"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { Input, Select } from "@/components/ui/input";
import { AddExpenseButton } from "@/components/transactions/add-expense-button";
import { useAccounts } from "@/lib/hooks/use-accounts";
import { useCards } from "@/lib/hooks/use-cards";
import { useCategories } from "@/lib/hooks/use-categories";
import { useHouseholdMembers } from "@/lib/hooks/use-household-members";
import {
  useDeleteTransaction,
  useTransactions,
  useUpdateTransaction,
  type TransactionWithRelations,
} from "@/lib/hooks/use-transactions";
import type { Account } from "@/lib/hooks/use-accounts";
import type { Category } from "@/lib/hooks/use-categories";
import type { HouseholdMember } from "@/lib/hooks/use-household-members";
import {
  TRANSACTION_TYPES as TYPES,
  TRANSFER_LIKE_TYPES,
  TRANSACTION_STATUSES,
  CURRENCIES,
} from "@/lib/constants";

type TxType = (typeof TYPES)[number]["value"];
type GroupBy = "none" | "account" | "type";

function isTransferLike(type: string): type is (typeof TRANSFER_LIKE_TYPES)[number] {
  return (TRANSFER_LIKE_TYPES as readonly string[]).includes(type);
}

function sourceAccountOptions(accounts: Account[], type: TxType) {
  if (type === "card_payment" || type === "financing_installment") {
    return accounts.filter((a) => a.type !== "credit_card");
  }
  return accounts;
}

function destinationOptions(accounts: Account[], fromAccountId: string) {
  const from = accounts.find((a) => a.id === fromAccountId);
  return accounts.filter((a) => {
    if (a.id === fromAccountId) return false;
    if (from && a.currency !== from.currency) return false;
    return true;
  });
}

const EMPTY = "__all__";

export default function TransactionsPage() {
  const { data: accounts } = useAccounts();
  const { data: categories } = useCategories();
  const { data: members } = useHouseholdMembers();
  const { data: transactions, isLoading } = useTransactions();

  const [search, setSearch] = useState("");
  const [accountFilter, setAccountFilter] = useState(EMPTY);
  const [categoryFilter, setCategoryFilter] = useState(EMPTY);
  const [memberFilter, setMemberFilter] = useState(EMPTY);
  const [typeFilter, setTypeFilter] = useState(EMPTY);
  const [currencyFilter, setCurrencyFilter] = useState(EMPTY);
  const [statusFilter, setStatusFilter] = useState(EMPTY);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [groupBy, setGroupBy] = useState<GroupBy>("none");

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (transactions ?? []).filter((tx) => {
      if (accountFilter !== EMPTY && tx.account_id !== accountFilter && tx.to_account_id !== accountFilter) return false;
      if (categoryFilter !== EMPTY && tx.category_id !== categoryFilter) return false;
      if (memberFilter !== EMPTY && tx.created_by !== memberFilter) return false;
      if (typeFilter !== EMPTY && tx.type !== typeFilter) return false;
      if (currencyFilter !== EMPTY && tx.currency !== currencyFilter) return false;
      if (statusFilter !== EMPTY && tx.status !== statusFilter) return false;
      if (dateFrom && tx.transaction_date < dateFrom) return false;
      if (dateTo && tx.transaction_date > dateTo) return false;
      if (q) {
        const haystack = `${tx.description ?? ""} ${tx.categories?.name ?? ""} ${tx.accounts?.name ?? ""}`.toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      return true;
    });
  }, [transactions, search, accountFilter, categoryFilter, memberFilter, typeFilter, currencyFilter, statusFilter, dateFrom, dateTo]);

  const groups = useMemo(() => {
    if (groupBy === "none") return [{ heading: null as string | null, items: filtered }];
    const map = new Map<string, TransactionWithRelations[]>();
    for (const tx of filtered) {
      const key =
        groupBy === "account"
          ? tx.accounts?.name ?? "Sin cuenta"
          : TYPES.find((t) => t.value === tx.type)?.label ?? tx.type;
      map.set(key, [...(map.get(key) ?? []), tx]);
    }
    return Array.from(map.entries()).map(([heading, items]) => ({ heading, items }));
  }, [filtered, groupBy]);

  const hasActiveFilters =
    search !== "" ||
    accountFilter !== EMPTY ||
    categoryFilter !== EMPTY ||
    memberFilter !== EMPTY ||
    typeFilter !== EMPTY ||
    currencyFilter !== EMPTY ||
    statusFilter !== EMPTY ||
    dateFrom !== "" ||
    dateTo !== "";

  function clearFilters() {
    setSearch("");
    setAccountFilter(EMPTY);
    setCategoryFilter(EMPTY);
    setMemberFilter(EMPTY);
    setTypeFilter(EMPTY);
    setCurrencyFilter(EMPTY);
    setStatusFilter(EMPTY);
    setDateFrom("");
    setDateTo("");
  }

  return (
    <div className="max-w-3xl">
      <div className="flex items-baseline justify-between mb-6">
        <h1 className="text-2xl font-bold text-on-surface tracking-tight flex items-center gap-2">
          <Icon name="swap_horiz" className="text-primary" filled />
          Transacciones
        </h1>
        <div className="flex items-center gap-4">
          <Link
            href="/transactions/import"
            className="text-xs text-on-surface-variant hover:text-on-surface underline"
          >
            Importar CSV
          </Link>
          <AddExpenseButton label="+ Agregar transacción" />
        </div>
      </div>

      <Card className="mb-6">
        <div className="flex flex-wrap gap-3 items-end">
          <div className="flex-1 min-w-[160px]">
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por descripción, categoría, cuenta..."
            />
          </div>
          <div className="w-40">
            <Select value={accountFilter} onChange={(e) => setAccountFilter(e.target.value)}>
              <option value={EMPTY}>Todas las cuentas</option>
              {accounts?.map((a) => (
                <option key={a.id} value={a.id}>{a.name}</option>
              ))}
            </Select>
          </div>
          <div className="w-40">
            <Select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)}>
              <option value={EMPTY}>Todas las categorías</option>
              {categories?.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </Select>
          </div>
          <div className="w-40">
            <Select value={memberFilter} onChange={(e) => setMemberFilter(e.target.value)}>
              <option value={EMPTY}>Todos los miembros</option>
              {members?.map((m) => (
                <option key={m.user_id} value={m.user_id}>{m.profiles?.full_name || "Sin nombre"}</option>
              ))}
            </Select>
          </div>
          <div className="w-40">
            <Select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}>
              <option value={EMPTY}>Todos los tipos</option>
              {TYPES.map((t) => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </Select>
          </div>
          <div className="w-32">
            <Select value={currencyFilter} onChange={(e) => setCurrencyFilter(e.target.value)}>
              <option value={EMPTY}>Todas las monedas</option>
              {CURRENCIES.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </Select>
          </div>
          <div className="w-36">
            <Select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
              <option value={EMPTY}>Todos los estados</option>
              {TRANSACTION_STATUSES.map((s) => (
                <option key={s.value} value={s.value}>{s.label}</option>
              ))}
            </Select>
          </div>
          <div className="w-36">
            <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
          </div>
          <div className="w-36">
            <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
          </div>
          <div className="w-44">
            <Select value={groupBy} onChange={(e) => setGroupBy(e.target.value as GroupBy)}>
              <option value="none">Sin agrupar</option>
              <option value="account">Agrupar por cuenta</option>
              <option value="type">Agrupar por tipo</option>
            </Select>
          </div>
          {hasActiveFilters && (
            <Button variant="tertiary" onClick={clearFilters}>
              Limpiar filtros
            </Button>
          )}
        </div>
      </Card>

      {isLoading ? (
        <p className="text-on-surface-variant text-sm">Cargando...</p>
      ) : filtered.length > 0 ? (
        <div className="flex flex-col gap-6">
          {groups.map((group) => (
            <div key={group.heading ?? "all"}>
              {group.heading && (
                <p className="font-mono text-xs uppercase tracking-wider text-on-surface-variant mb-2">
                  {group.heading} ({group.items.length})
                </p>
              )}
              <ul className="space-y-3">
                {group.items.map((tx) => (
                  <li key={tx.id}>
                    <TransactionRow
                      tx={tx}
                      accounts={accounts ?? []}
                      categories={categories ?? []}
                      members={members ?? []}
                    />
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-on-surface-variant text-sm">
          {hasActiveFilters ? "Ninguna transacción coincide con estos filtros." : "No hay transacciones todavía."}
        </p>
      )}
    </div>
  );
}

function TransactionRow({
  tx,
  accounts,
  categories,
  members,
}: {
  tx: TransactionWithRelations;
  accounts: Account[];
  categories: Category[];
  members: HouseholdMember[];
}) {
  const updateTransaction = useUpdateTransaction();
  const deleteTransaction = useDeleteTransaction();
  const { data: cards } = useCards();

  const [isEditing, setIsEditing] = useState(false);
  const [type, setType] = useState<TxType>(tx.type as TxType);
  const [accountId, setAccountId] = useState(tx.account_id);
  const [toAccountId, setToAccountId] = useState(tx.to_account_id ?? "");
  const [cardId, setCardId] = useState("");
  const [cardCurrency, setCardCurrency] = useState("");
  const [categoryId, setCategoryId] = useState(tx.category_id ?? "");
  const [amount, setAmount] = useState(String(tx.amount));
  const [description, setDescription] = useState(tx.description ?? "");
  const [date, setDate] = useState(tx.transaction_date);
  const [status, setStatus] = useState(tx.status);
  const [error, setError] = useState<string | null>(null);

  const isTransfer = isTransferLike(type);
  const isCardPayment = type === "card_payment";

  const selectedAccount = useMemo(
    () => accounts.find((a) => a.id === accountId),
    [accounts, accountId],
  );

  const sourceAccounts = useMemo(
    () => sourceAccountOptions(accounts, type),
    [accounts, type],
  );

  const destinationAccounts = useMemo(
    () => destinationOptions(accounts, accountId),
    [accounts, accountId],
  );

  const cardCurrencyAccounts = useMemo(
    () => accounts.filter((a) => a.card_id === cardId),
    [accounts, cardId],
  );
  const resolvedCardAccount = useMemo(
    () =>
      cardCurrencyAccounts.length === 1
        ? cardCurrencyAccounts[0]
        : cardCurrencyAccounts.find((a) => a.currency === cardCurrency),
    [cardCurrencyAccounts, cardCurrency],
  );
  const effectiveToAccountId = isCardPayment ? (resolvedCardAccount?.id ?? "") : toAccountId;

  function startEditing() {
    setType(tx.type as TxType);
    setAccountId(tx.account_id);
    setToAccountId(tx.to_account_id ?? "");
    // Si ya era un pago de tarjeta, preseleccionar la tarjeta a partir de la
    // cuenta destino guardada, para no obligar a re-elegirla al editar.
    const linkedCard = tx.to_account_id
      ? accounts.find((a) => a.id === tx.to_account_id)?.card_id
      : null;
    setCardId(linkedCard ?? "");
    setCardCurrency("");
    setCategoryId(tx.category_id ?? "");
    setAmount(String(tx.amount));
    setDescription(tx.description ?? "");
    setDate(tx.transaction_date);
    setStatus(tx.status);
    setError(null);
    setIsEditing(true);
  }

  async function handleSave() {
    setError(null);
    if (!selectedAccount) {
      setError("Elegí una cuenta.");
      return;
    }
    if (isCardPayment && !resolvedCardAccount) {
      setError("Elegí la tarjeta (y la moneda, si tiene más de una) a pagar.");
      return;
    }
    if (isTransfer && !isCardPayment && !toAccountId) {
      setError("Elegí la cuenta destino.");
      return;
    }
    try {
      await updateTransaction.mutateAsync({
        id: tx.id,
        account_id: selectedAccount.id,
        to_account_id: isTransfer ? effectiveToAccountId : null,
        category_id: isTransfer ? null : categoryId || null,
        type,
        amount: Number(amount),
        currency: selectedAccount.currency,
        description: description || null,
        transaction_date: date,
        status,
      });
      setIsEditing(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al guardar");
    }
  }

  async function handleDelete() {
    if (!confirm("¿Eliminar esta transacción?")) return;
    await deleteTransaction.mutateAsync(tx.id);
  }

  if (isEditing) {
    return (
      <Card className="py-4">
        <div className="flex flex-col gap-3">
          <div className="flex gap-3">
            <Select
              value={type}
              onChange={(e) => {
                setType(e.target.value as TxType);
                setToAccountId("");
                setCardId("");
                setCardCurrency("");
              }}
            >
              {TYPES.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </Select>
            <Input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
            <Select value={status} onChange={(e) => setStatus(e.target.value)}>
              {TRANSACTION_STATUSES.map((s) => (
                <option key={s.value} value={s.value}>{s.label}</option>
              ))}
            </Select>
          </div>

          <div className="flex gap-3">
            <Select
              value={accountId}
              onChange={(e) => {
                setAccountId(e.target.value);
                setToAccountId("");
              }}
            >
              {sourceAccounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name} ({a.currency})
                </option>
              ))}
            </Select>
            <Input
              type="number"
              step="0.01"
              min={type === "adjustment" ? undefined : "0"}
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
          </div>

          {isCardPayment && (
            <div className="flex gap-3">
              <Select
                value={cardId}
                onChange={(e) => {
                  setCardId(e.target.value);
                  setCardCurrency("");
                }}
              >
                <option value="">Tarjeta a pagar...</option>
                {cards?.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </Select>
              {cardCurrencyAccounts.length > 1 && (
                <Select value={cardCurrency} onChange={(e) => setCardCurrency(e.target.value)}>
                  <option value="">Moneda...</option>
                  {cardCurrencyAccounts.map((a) => (
                    <option key={a.id} value={a.currency}>{a.currency}</option>
                  ))}
                </Select>
              )}
            </div>
          )}

          {isTransfer && !isCardPayment && (
            <Select
              value={toAccountId}
              onChange={(e) => setToAccountId(e.target.value)}
            >
              <option value="">Cuenta destino...</option>
              {destinationAccounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name} ({a.currency})
                </option>
              ))}
            </Select>
          )}

          {!isTransfer && (
            <Select
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
            >
              <option value="">Sin categoría</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </Select>
          )}

          <Input
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Descripción (opcional)"
          />

          {error && (
            <p className="text-sm text-error" role="alert">
              {error}
            </p>
          )}

          <div className="flex gap-2 justify-end">
            <Button variant="secondary" onClick={() => setIsEditing(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSave} disabled={updateTransaction.isPending}>
              {updateTransaction.isPending ? "Guardando..." : "Guardar"}
            </Button>
          </div>
        </div>
      </Card>
    );
  }

  const isPositive =
    tx.type === "income" || tx.type === "refund" || (tx.type === "adjustment" && tx.amount >= 0);
  const sign = tx.type === "adjustment" ? (tx.amount < 0 ? "-" : "+") : isPositive ? "+" : "-";
  const typeLabel = TYPES.find((t) => t.value === tx.type)?.label ?? tx.type;
  const statusLabel = TRANSACTION_STATUSES.find((s) => s.value === tx.status)?.label;
  const member = members.find((m) => m.user_id === tx.created_by);

  return (
    <Card className="flex items-center justify-between py-4">
      <div>
        <p className="text-on-surface font-medium">
          {tx.description || tx.categories?.name || typeLabel}
        </p>
        <p className="text-on-surface-variant text-sm font-mono">
          {tx.transaction_date} · {tx.accounts?.name}
          {tx.to_account?.name ? ` → ${tx.to_account.name}` : ""}
          {tx.categories?.name ? ` · ${tx.categories.name}` : ""}
          {member?.profiles?.full_name ? ` · ${member.profiles.full_name}` : ""}
          {tx.status !== "confirmed" ? ` · ${statusLabel}` : ""}
        </p>
      </div>
      <div className="flex items-center gap-4">
        <span
          className={`font-mono font-semibold ${
            isPositive ? "text-secondary" : "text-on-surface"
          } ${tx.status === "cancelled" ? "line-through opacity-50" : ""}`}
        >
          {sign}
          {Math.abs(tx.amount)} {tx.currency}
        </span>
        <Button variant="secondary" onClick={startEditing}>
          Editar
        </Button>
        <Button variant="danger" onClick={handleDelete}>
          Eliminar
        </Button>
      </div>
    </Card>
  );
}
