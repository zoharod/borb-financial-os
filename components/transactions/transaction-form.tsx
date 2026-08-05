"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input, Select, Label } from "@/components/ui/input";
import { useAccounts, type Account } from "@/lib/hooks/use-accounts";
import { useCategories } from "@/lib/hooks/use-categories";
import { useCommitments } from "@/lib/hooks/use-commitments";
import { useCreateTransaction } from "@/lib/hooks/use-transactions";
import { useCurrentHousehold } from "@/lib/hooks/use-current-household";
import { useHouseholdMembers } from "@/lib/hooks/use-household-members";
import { useAuthUserId } from "@/lib/hooks/use-auth-user-id";
import { TRANSACTION_TYPES as TYPES, TRANSFER_LIKE_TYPES } from "@/lib/constants";
import { todayISO } from "@/lib/date";

type TxType = (typeof TYPES)[number]["value"];

function isTransferLike(type: string): type is (typeof TRANSFER_LIKE_TYPES)[number] {
  return (TRANSFER_LIKE_TYPES as readonly string[]).includes(type);
}

// Cuentas válidas como destino de una transferencia/pago de tarjeta: misma
// moneda (no hay conversión, ver architecture.md), distinta de la cuenta de
// origen, y si es pago de tarjeta, filtrado a cuentas tipo "Tarjeta de crédito".
function destinationOptions(accounts: Account[], fromAccountId: string, type: TxType) {
  const from = accounts.find((a) => a.id === fromAccountId);
  return accounts.filter((a) => {
    if (a.id === fromAccountId) return false;
    if (from && a.currency !== from.currency) return false;
    if (type === "card_payment" && a.type !== "credit_card") return false;
    return true;
  });
}

// Formulario de creación, reusado por /transactions y por el botón "Agregar
// gasto" del dashboard/sidebar (ver components/transactions/add-expense-button.tsx).
export function TransactionForm({
  defaultType = "expense",
  onSuccess,
}: {
  defaultType?: TxType;
  onSuccess?: () => void;
}) {
  const { data: household } = useCurrentHousehold();
  const { data: accounts } = useAccounts();
  const { data: categories } = useCategories();
  const { data: members } = useHouseholdMembers();
  const { data: commitments } = useCommitments();
  const currentUserId = useAuthUserId();
  const createTransaction = useCreateTransaction();

  const [type, setType] = useState<TxType>(defaultType);
  const [accountId, setAccountId] = useState("");
  const [toAccountId, setToAccountId] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [commitmentId, setCommitmentId] = useState("");
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [date, setDate] = useState(todayISO());
  const [memberUserId, setMemberUserId] = useState("");
  const [error, setError] = useState<string | null>(null);

  // Por default el gasto queda a nombre de quien está logueado — el select
  // permite cambiarlo (ej. cargar un gasto que hizo tu pareja). Se deriva en
  // el render en vez de sincronizarse con un efecto (currentUserId llega
  // async desde useAuthUserId) para no disparar un setState extra.
  const effectiveMemberUserId = memberUserId || currentUserId || "";

  const isTransfer = isTransferLike(type);
  const isInstallment = type === "financing_installment";

  const selectedAccount = useMemo(
    () => accounts?.find((a) => a.id === accountId),
    [accounts, accountId],
  );

  const defaultExtraCategory = useMemo(
    () => categories?.find((c) => c.is_extra_default),
    [categories],
  );

  const destinationAccounts = useMemo(
    () => destinationOptions(accounts ?? [], accountId, type),
    [accounts, accountId, type],
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
    if (isTransfer && !toAccountId) {
      setError("Elegí la cuenta destino.");
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
        to_account_id: isTransfer ? toAccountId : null,
        category_id: isTransfer ? null : resolvedCategoryId,
        commitment_id: isInstallment ? commitmentId || null : null,
        type,
        amount: Number(amount),
        currency: selectedAccount.currency,
        description: description || null,
        transaction_date: date,
        created_by: effectiveMemberUserId || undefined,
      });
      setAmount("");
      setDescription("");
      setToAccountId("");
      setCommitmentId("");
      onSuccess?.();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Error al registrar la transacción",
      );
    }
  }

  if (accounts && accounts.length === 0) {
    return (
      <p className="text-on-surface-variant text-sm">
        Primero creá una cuenta en la sección Cuentas.
      </p>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div className="flex gap-4">
        <div className="flex-1">
          <Label>Tipo</Label>
          <Select
            value={type}
            onChange={(e) => {
              setType(e.target.value as TxType);
              setToAccountId("");
            }}
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
          <Label>{isTransfer ? "Cuenta de origen" : "Cuenta"}</Label>
          <Select
            required
            value={accountId}
            onChange={(e) => {
              setAccountId(e.target.value);
              setToAccountId("");
            }}
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
            min={type === "adjustment" ? undefined : "0"}
            required
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
          />
        </div>
      </div>

      {isTransfer && (
        <div>
          <Label>{type === "card_payment" ? "Tarjeta a pagar" : "Cuenta destino"}</Label>
          <Select required value={toAccountId} onChange={(e) => setToAccountId(e.target.value)}>
            <option value="">Elegir...</option>
            {destinationAccounts.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name} ({a.currency})
              </option>
            ))}
          </Select>
          {accountId && destinationAccounts.length === 0 && (
            <p className="text-on-surface-variant text-xs mt-1">
              {type === "card_payment"
                ? 'No hay ninguna cuenta tipo "Tarjeta de crédito" en esta moneda todavía.'
                : "No hay otra cuenta en la misma moneda todavía."}
            </p>
          )}
        </div>
      )}

      {isInstallment && (
        <div>
          <Label>Compromiso al que corresponde (opcional)</Label>
          <Select value={commitmentId} onChange={(e) => setCommitmentId(e.target.value)}>
            <option value="">Sin especificar</option>
            {commitments?.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name} ({c.currency})
              </option>
            ))}
          </Select>
        </div>
      )}

      {!isTransfer && (
        <div>
          <Label>Categoría (opcional)</Label>
          <Select value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
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
      )}

      <div className="flex gap-4">
        <div className="flex-1">
          <Label>Descripción (opcional)</Label>
          <Input value={description} onChange={(e) => setDescription(e.target.value)} />
        </div>
        <div className="flex-1">
          <Label>Miembro del hogar</Label>
          <Select value={effectiveMemberUserId} onChange={(e) => setMemberUserId(e.target.value)}>
            {members?.map((m) => (
              <option key={m.user_id} value={m.user_id}>
                {m.profiles?.full_name || "Sin nombre"}
              </option>
            ))}
          </Select>
        </div>
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
  );
}
