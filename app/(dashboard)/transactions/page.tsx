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
} from "@/lib/hooks/use-transactions";

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
  const deleteTransaction = useDeleteTransaction();

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

  async function handleDelete(id: string) {
    if (!confirm("¿Eliminar esta transacción?")) return;
    await deleteTransaction.mutateAsync(id);
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
                  <Button variant="danger" onClick={() => handleDelete(tx.id)}>
                    Eliminar
                  </Button>
                </div>
              </Card>
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
