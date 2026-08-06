"use client";

import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { Modal } from "@/components/ui/modal";
import { Input, Select, Label } from "@/components/ui/input";
import { useCurrentHousehold } from "@/lib/hooks/use-current-household";
import {
  useAccounts,
  useCreateAccount,
  useDeleteAccount,
  useUpdateAccount,
  type Account,
} from "@/lib/hooks/use-accounts";
import { useAccountBalances } from "@/lib/hooks/use-account-balances";
import { useCreateTransaction } from "@/lib/hooks/use-transactions";
import { CURRENCIES, ACCOUNT_TYPES } from "@/lib/constants";
import { todayISO } from "@/lib/date";

// Las tarjetas de crédito ahora son su propio módulo (/cards) — son pasivo,
// no activo, y no se crean/editan más como "cuenta" acá. Ver item 1 del
// feedback de producto y domain.md "Cuentas vs. Tarjetas".
const TYPES = ACCOUNT_TYPES.filter((t) => t.value !== "credit_card");

export default function AccountsPage() {
  const { data: household } = useCurrentHousehold();
  const { data: accounts, isLoading } = useAccounts();
  const { data: balances } = useAccountBalances();
  const [addOpen, setAddOpen] = useState(false);

  const nonCardAccounts = (accounts ?? []).filter((a) => a.type !== "credit_card");

  return (
    <div className="max-w-2xl">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-on-surface tracking-tight flex items-center gap-2">
          <Icon name="account_balance_wallet" className="text-primary" filled />
          Cuentas
        </h1>
        <Button onClick={() => setAddOpen(true)}>
          <Icon name="add" size={18} /> Agregar cuenta
        </Button>
      </div>

      {isLoading ? (
        <p className="text-on-surface-variant text-sm">Cargando...</p>
      ) : nonCardAccounts.length > 0 ? (
        <ul className="space-y-3">
          {nonCardAccounts.map((account: Account) => (
            <li key={account.id}>
              <AccountRow
                account={account}
                balance={balances?.[account.id] ?? 0}
                householdId={household?.household_id}
              />
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-on-surface-variant text-sm">
          No hay cuentas todavía. Agregá la primera con el botón de arriba.
        </p>
      )}

      {addOpen && (
        <Modal title="Agregar cuenta" onClose={() => setAddOpen(false)}>
          <AccountForm
            householdId={household?.household_id}
            onDone={() => setAddOpen(false)}
          />
        </Modal>
      )}
    </div>
  );
}

function AccountForm({
  householdId,
  onDone,
}: {
  householdId: string | undefined;
  onDone: () => void;
}) {
  const createAccount = useCreateAccount();
  const [name, setName] = useState("");
  const [currency, setCurrency] = useState<(typeof CURRENCIES)[number]>("HNL");
  const [type, setType] = useState<(typeof TYPES)[number]["value"]>("checking");
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!householdId) {
      setError("No se encontró tu household todavía.");
      return;
    }
    try {
      await createAccount.mutateAsync({ household_id: householdId, name, currency, type });
      onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al crear la cuenta");
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div>
        <Label>Nombre</Label>
        <Input
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Pagos L, Ahorro $, ..."
        />
      </div>
      <div className="flex gap-4">
        <div className="flex-1">
          <Label>Moneda</Label>
          <Select value={currency} onChange={(e) => setCurrency(e.target.value as (typeof CURRENCIES)[number])}>
            {CURRENCIES.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </Select>
        </div>
        <div className="flex-1">
          <Label>Tipo</Label>
          <Select value={type} onChange={(e) => setType(e.target.value as (typeof TYPES)[number]["value"])}>
            {TYPES.map((t) => (
              <option key={t.value} value={t.value}>{t.label}</option>
            ))}
          </Select>
        </div>
      </div>
      {error && <p className="text-sm text-error" role="alert">{error}</p>}
      <Button type="submit" disabled={createAccount.isPending}>
        {createAccount.isPending ? "Creando..." : "Agregar cuenta"}
      </Button>
    </form>
  );
}

function AccountRow({
  account,
  balance,
  householdId,
}: {
  account: Account;
  balance: number;
  householdId: string | undefined;
}) {
  const updateAccount = useUpdateAccount();
  const deleteAccount = useDeleteAccount();
  const createTransaction = useCreateTransaction();

  const [isEditing, setIsEditing] = useState(false);
  const [name, setName] = useState(account.name);
  const [currency, setCurrency] = useState<(typeof CURRENCIES)[number]>(
    account.currency as (typeof CURRENCIES)[number],
  );
  const [type, setType] = useState<(typeof TYPES)[number]["value"]>(
    account.type as (typeof TYPES)[number]["value"],
  );
  const [error, setError] = useState<string | null>(null);

  const [isReconciling, setIsReconciling] = useState(false);
  const [realBalance, setRealBalance] = useState("");
  const [reconcileError, setReconcileError] = useState<string | null>(null);

  function startEditing() {
    setName(account.name);
    setCurrency(account.currency as (typeof CURRENCIES)[number]);
    setType(account.type as (typeof TYPES)[number]["value"]);
    setError(null);
    setIsEditing(true);
  }

  async function handleSave() {
    setError(null);
    try {
      await updateAccount.mutateAsync({ id: account.id, name, currency, type });
      setIsEditing(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al guardar");
    }
  }

  async function handleDelete() {
    if (!confirm("¿Eliminar esta cuenta?")) return;
    await deleteAccount.mutateAsync(account.id);
  }

  const diff =
    realBalance !== "" ? Number(realBalance) - balance : null;

  async function handleReconcile() {
    setReconcileError(null);
    if (!householdId || diff === null) return;
    try {
      await createTransaction.mutateAsync({
        household_id: householdId,
        account_id: account.id,
        to_account_id: null,
        category_id: null,
        type: "adjustment",
        amount: diff,
        currency: account.currency,
        description: "Conciliación de saldo",
        transaction_date: todayISO(),
        reconciled_at: new Date().toISOString(),
      });
      setIsReconciling(false);
      setRealBalance("");
    } catch (err) {
      setReconcileError(
        err instanceof Error ? err.message : "Error al registrar el ajuste",
      );
    }
  }

  if (isEditing) {
    return (
      <Card className="py-4">
        <div className="flex flex-col gap-3">
          <Input value={name} onChange={(e) => setName(e.target.value)} />
          <div className="flex gap-3">
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
          {error && (
            <p className="text-sm text-error" role="alert">
              {error}
            </p>
          )}
          <div className="flex gap-2 justify-end">
            <Button variant="secondary" onClick={() => setIsEditing(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSave} disabled={updateAccount.isPending}>
              {updateAccount.isPending ? "Guardando..." : "Guardar"}
            </Button>
          </div>
        </div>
      </Card>
    );
  }

  const ACCOUNT_ICONS: Record<string, string> = {
    checking: "account_balance",
    savings: "savings",
  };

  return (
    <Card className="py-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-primary-container/20 flex items-center justify-center border border-primary/20 flex-shrink-0">
            <Icon
              name={ACCOUNT_ICONS[account.type] ?? "account_balance_wallet"}
              className="text-primary"
            />
          </div>
          <div>
            <p className="text-on-surface font-medium">{account.name}</p>
            <p className="text-on-surface-variant text-sm">
              {account.currency} ·{" "}
              {TYPES.find((t) => t.value === account.type)?.label ?? account.type}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <span className="font-mono text-on-surface">
            {balance.toFixed(2)} {account.currency}
          </span>
          <Button
            variant="secondary"
            onClick={() => {
              setReconcileError(null);
              setIsReconciling((v) => !v);
            }}
          >
            Conciliar
          </Button>
          <Button variant="secondary" onClick={startEditing}>
            Editar
          </Button>
          <Button variant="danger" onClick={handleDelete}>
            Eliminar
          </Button>
        </div>
      </div>

      {isReconciling && (
        <div className="mt-4 pt-4 border-t border-outline-variant/20 flex flex-col gap-3">
          <div>
            <Label>Saldo según tu banco ({account.currency})</Label>
            <Input
              type="number"
              step="0.01"
              value={realBalance}
              onChange={(e) => setRealBalance(e.target.value)}
              placeholder={balance.toFixed(2)}
            />
          </div>
          {diff !== null && diff !== 0 && (
            <p className="text-sm text-on-surface-variant">
              Diferencia: {diff > 0 ? "+" : ""}
              {diff.toFixed(2)} {account.currency}
            </p>
          )}
          {diff === 0 && (
            <p className="text-sm text-secondary">Sin diferencia — no hace falta ajuste.</p>
          )}
          {reconcileError && (
            <p className="text-sm text-error" role="alert">
              {reconcileError}
            </p>
          )}
          <div className="flex justify-end">
            <Button
              onClick={handleReconcile}
              disabled={diff === null || diff === 0 || createTransaction.isPending}
            >
              {createTransaction.isPending
                ? "Guardando..."
                : diff !== null
                  ? `Registrar ajuste de ${diff > 0 ? "+" : ""}${diff.toFixed(2)}`
                  : "Registrar ajuste"}
            </Button>
          </div>
        </div>
      )}
    </Card>
  );
}
