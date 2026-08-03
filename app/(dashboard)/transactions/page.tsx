"use client";

import { useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input, Select, Label } from "@/components/ui/input";
import { useCurrentHousehold } from "@/lib/hooks/use-current-household";
import { useAccounts } from "@/lib/hooks/use-accounts";
import { useCategories } from "@/lib/hooks/use-categories";
import {
  useCreateTransaction,
  useDeleteTransaction,
  useTransactions,
  useUpdateTransaction,
  type TransactionWithRelations,
} from "@/lib/hooks/use-transactions";
import type { Account } from "@/lib/hooks/use-accounts";
import type { Category } from "@/lib/hooks/use-categories";

const TYPES = [
  { value: "expense", label: "Gasto" },
  { value: "income", label: "Ingreso" },
  { value: "transfer", label: "Transferencia" },
] as const;

function todayISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export default function TransactionsPage() {
  const { data: household } = useCurrentHousehold();
  const { data: accounts } = useAccounts();
  const { data: categories } = useCategories();
  const { data: transactions, isLoading } = useTransactions();
  const createTransaction = useCreateTransaction();

  const [type, setType] = useState<(typeof TYPES)[number]["value"]>("expense");
  const [accountId, setAccountId] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [date, setDate] = useState(todayISO());
  const [error, setError] = useState<string | null>(null);

  const selectedAccount = useMemo(
    () => accounts?.find((a) => a.id === accountId),
    [accounts, accountId],
  );

  const defaultExtraCategory = useMemo(
    () => categories?.find((c) => c.is_extra_default),
    [categories],
  );

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!household) {
      setError("No se encontró tu household todavía.");
      return;
    }
    if (!selectedAccount) {
      setError("Elegí una cuenta.");
      return;
    }

    const resolvedCategoryId =
      categoryId ||
      (type === "expense" ? defaultExtraCategory?.id : undefined) ||
      null;

    try {
      await createTransaction.mutateAsync({
        household_id: household.household_id,
        account_id: selectedAccount.id,
        category_id: resolvedCategoryId,
        type,
        amount: Number(amount),
        currency: selectedAccount.currency,
        description: description || null,
        transaction_date: date,
      });
      setAmount("");
      setDescription("");
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Error al registrar la transacción",
      );
    }
  }

  const noAccounts = accounts && accounts.length === 0;

  return (
    <div className="max-w-2xl">
      <h1 className="text-xl font-semibold text-on-surface mb-6">
        Transacciones
      </h1>

      <Card className="mb-6">
        {noAccounts ? (
          <p className="text-on-surface-variant text-sm">
            Primero creá una cuenta en la sección Cuentas.
          </p>
        ) : (
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div className="flex gap-4">
              <div className="flex-1">
                <Label>Tipo</Label>
                <Select
                  value={type}
                  onChange={(e) =>
                    setType(e.target.value as (typeof TYPES)[number]["value"])
                  }
                >
                  {TYPES.map((t) => (
                    <option key={t.value} value={t.value}>
                      {t.label}
                    </option>
                  ))}
                </Select>
              </div>
              <div className="flex-1">
                <Label>Fecha</Label>
                <Input
                  type="date"
                  required
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                />
              </div>
            </div>

            <div className="flex gap-4">
              <div className="flex-1">
                <Label>Cuenta</Label>
                <Select
                  required
                  value={accountId}
                  onChange={(e) => setAccountId(e.target.value)}
                >
                  <option value="">Elegir...</option>
                  {accounts?.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name} ({a.currency})
                    </option>
                  ))}
                </Select>
              </div>
              <div className="flex-1">
                <Label>Monto {selectedAccount ? `(${selectedAccount.currency})` : ""}</Label>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  required
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                />
              </div>
            </div>

            <div>
              <Label>Categoría (opcional)</Label>
              <Select
                value={categoryId}
                onChange={(e) => setCategoryId(e.target.value)}
              >
                <option value="">
                  Sin categoría
                  {defaultExtraCategory && type === "expense"
                    ? ` (se usa "${defaultExtraCategory.name}")`
                    : ""}
                </option>
                {categories?.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </Select>
            </div>

            <div>
              <Label>Descripción (opcional)</Label>
              <Input
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>

            {error && (
              <p className="text-sm text-error" role="alert">
                {error}
              </p>
            )}

            <Button type="submit" disabled={createTransaction.isPending}>
              {createTransaction.isPending ? "Guardando..." : "Registrar"}
            </Button>
          </form>
        )}
      </Card>

      {isLoading ? (
        <p className="text-on-surface-variant text-sm">Cargando...</p>
      ) : transactions && transactions.length > 0 ? (
        <ul className="space-y-3">
          {transactions.map((tx) => (
            <li key={tx.id}>
              <TransactionRow
                tx={tx}
                accounts={accounts ?? []}
                categories={categories ?? []}
              />
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-on-surface-variant text-sm">
          No hay transacciones todavía.
        </p>
      )}
    </div>
  );
}

function TransactionRow({
  tx,
  accounts,
  categories,
}: {
  tx: TransactionWithRelations;
  accounts: Account[];
  categories: Category[];
}) {
  const updateTransaction = useUpdateTransaction();
  const deleteTransaction = useDeleteTransaction();

  const [isEditing, setIsEditing] = useState(false);
  const [type, setType] = useState<(typeof TYPES)[number]["value"]>(
    tx.type as (typeof TYPES)[number]["value"],
  );
  const [accountId, setAccountId] = useState(tx.account_id);
  const [categoryId, setCategoryId] = useState(tx.category_id ?? "");
  const [amount, setAmount] = useState(String(tx.amount));
  const [description, setDescription] = useState(tx.description ?? "");
  const [date, setDate] = useState(tx.transaction_date);
  const [error, setError] = useState<string | null>(null);

  const selectedAccount = useMemo(
    () => accounts.find((a) => a.id === accountId),
    [accounts, accountId],
  );

  function startEditing() {
    setType(tx.type as (typeof TYPES)[number]["value"]);
    setAccountId(tx.account_id);
    setCategoryId(tx.category_id ?? "");
    setAmount(String(tx.amount));
    setDescription(tx.description ?? "");
    setDate(tx.transaction_date);
    setError(null);
    setIsEditing(true);
  }

  async function handleSave() {
    setError(null);
    if (!selectedAccount) {
      setError("Elegí una cuenta.");
      return;
    }
    try {
      await updateTransaction.mutateAsync({
        id: tx.id,
        account_id: selectedAccount.id,
        category_id: categoryId || null,
        type,
        amount: Number(amount),
        currency: selectedAccount.currency,
        description: description || null,
        transaction_date: date,
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
              onChange={(e) =>
                setType(e.target.value as (typeof TYPES)[number]["value"])
              }
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
          </div>

          <div className="flex gap-3">
            <Select
              value={accountId}
              onChange={(e) => setAccountId(e.target.value)}
            >
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name} ({a.currency})
                </option>
              ))}
            </Select>
            <Input
              type="number"
              step="0.01"
              min="0"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
          </div>

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

  return (
    <Card className="flex items-center justify-between py-4">
      <div>
        <p className="text-on-surface font-medium">
          {tx.description || tx.categories?.name || "Sin descripción"}
        </p>
        <p className="text-on-surface-variant text-sm font-mono">
          {tx.transaction_date} · {tx.accounts?.name}
          {tx.categories?.name ? ` · ${tx.categories.name}` : ""}
        </p>
      </div>
      <div className="flex items-center gap-4">
        <span
          className={`font-mono font-semibold ${
            tx.type === "income" ? "text-secondary" : "text-on-surface"
          }`}
        >
          {tx.type === "expense" ? "-" : "+"}
          {tx.amount} {tx.currency}
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
