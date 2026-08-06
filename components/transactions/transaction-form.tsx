"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input, Select, Label } from "@/components/ui/input";
import { useAccounts, type Account } from "@/lib/hooks/use-accounts";
import { useCards } from "@/lib/hooks/use-cards";
import { useCategories } from "@/lib/hooks/use-categories";
import { useCommitments } from "@/lib/hooks/use-commitments";
import { useCreateTransaction } from "@/lib/hooks/use-transactions";
import { useCurrentHousehold } from "@/lib/hooks/use-current-household";
import { useHouseholdMembers } from "@/lib/hooks/use-household-members";
import { useAuthUserId } from "@/lib/hooks/use-auth-user-id";
import {
  TRANSACTION_TYPES as TYPES,
  TRANSFER_LIKE_TYPES,
  TRANSACTION_STATUSES,
} from "@/lib/constants";
import { todayISO } from "@/lib/date";

type TxType = (typeof TYPES)[number]["value"];

function isTransferLike(type: string): type is (typeof TRANSFER_LIKE_TYPES)[number] {
  return (TRANSFER_LIKE_TYPES as readonly string[]).includes(type);
}

// Cuentas válidas como origen de un pago de tarjeta o de una cuota: nunca
// otra tarjeta (una tarjeta paga con plata líquida, no con otra deuda) — ver
// "Pago de tarjeta" en domain.md.
function sourceAccountOptions(accounts: Account[], type: TxType) {
  if (type === "card_payment" || type === "financing_installment") {
    return accounts.filter((a) => a.type !== "credit_card");
  }
  return accounts;
}

// Cuentas válidas como destino de una transferencia: misma moneda (no hay
// conversión, ver architecture.md), distinta de la cuenta de origen. El pago
// de tarjeta ya no usa esto — ver el selector tarjeta-primero más abajo.
function destinationOptions(accounts: Account[], fromAccountId: string) {
  const from = accounts.find((a) => a.id === fromAccountId);
  return accounts.filter((a) => {
    if (a.id === fromAccountId) return false;
    if (from && a.currency !== from.currency) return false;
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
  const { data: cards } = useCards();
  const { data: categories } = useCategories();
  const { data: members } = useHouseholdMembers();
  const { data: commitments } = useCommitments();
  const currentUserId = useAuthUserId();
  const createTransaction = useCreateTransaction();

  const [type, setType] = useState<TxType>(defaultType);
  const [accountId, setAccountId] = useState("");
  const [toAccountId, setToAccountId] = useState("");
  const [cardId, setCardId] = useState("");
  const [cardCurrency, setCardCurrency] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [commitmentId, setCommitmentId] = useState("");
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [date, setDate] = useState(todayISO());
  const [status, setStatus] =
    useState<(typeof TRANSACTION_STATUSES)[number]["value"]>("confirmed");
  const [memberUserId, setMemberUserId] = useState("");
  const [error, setError] = useState<string | null>(null);

  // Por default el gasto queda a nombre de quien está logueado — el select
  // permite cambiarlo (ej. cargar un gasto que hizo tu pareja). Se deriva en
  // el render en vez de sincronizarse con un efecto (currentUserId llega
  // async desde useAuthUserId) para no disparar un setState extra.
  const effectiveMemberUserId = memberUserId || currentUserId || "";

  const isTransfer = isTransferLike(type);
  const isCardPayment = type === "card_payment";
  const isInstallment = type === "financing_installment";

  const selectedAccount = useMemo(
    () => accounts?.find((a) => a.id === accountId),
    [accounts, accountId],
  );

  const defaultExtraCategory = useMemo(
    () => categories?.find((c) => c.is_extra_default),
    [categories],
  );

  const sourceAccounts = useMemo(
    () => sourceAccountOptions(accounts ?? [], type),
    [accounts, type],
  );

  const destinationAccounts = useMemo(
    () => destinationOptions(accounts ?? [], accountId),
    [accounts, accountId],
  );

  // Pago de tarjeta: primero se elige LA TARJETA (una fila por tarjeta, no
  // por cuenta-moneda — ver domain.md "Pago de tarjeta"), después la moneda
  // si esa tarjeta tiene saldo en más de una. La cuenta destino real (para
  // el insert) se resuelve a partir de esas dos elecciones.
  const cardCurrencyAccounts = useMemo(
    () => (accounts ?? []).filter((a) => a.card_id === cardId),
    [accounts, cardId],
  );
  const resolvedCardAccount = useMemo(
    () =>
      cardCurrencyAccounts.length === 1
        ? cardCurrencyAccounts[0]
        : cardCurrencyAccounts.find((a) => a.currency === cardCurrency),
    [cardCurrencyAccounts, cardCurrency],
  );
  const effectiveToAccountId = isCardPayment
    ? (resolvedCardAccount?.id ?? "")
    : toAccountId;

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
    if (isCardPayment && !resolvedCardAccount) {
      setError("Elegí la tarjeta (y la moneda, si tiene más de una) a pagar.");
      return;
    }
    if (isTransfer && !isCardPayment && !toAccountId) {
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
        to_account_id: isTransfer ? effectiveToAccountId : null,
        category_id: isTransfer ? null : resolvedCategoryId,
        commitment_id: isInstallment ? commitmentId || null : null,
        type,
        amount: Number(amount),
        currency: selectedAccount.currency,
        description: description || null,
        transaction_date: date,
        status,
        created_by: effectiveMemberUserId || undefined,
      });
      setAmount("");
      setDescription("");
      setToAccountId("");
      setCardId("");
      setCardCurrency("");
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
        <div className="flex-1">
          <Label>Estado</Label>
          <Select
            value={status}
            onChange={(e) =>
              setStatus(e.target.value as (typeof TRANSACTION_STATUSES)[number]["value"])
            }
          >
            {TRANSACTION_STATUSES.filter((s) => s.value !== "reconciled").map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </Select>
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
            {sourceAccounts.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name} ({a.currency})
              </option>
            ))}
          </Select>
          {accountId === "" && sourceAccounts.length === 0 && (isCardPayment || isInstallment) && (
            <p className="text-on-surface-variant text-xs mt-1">
              No hay ninguna cuenta líquida (no-tarjeta) todavía.
            </p>
          )}
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

      {isCardPayment && (
        <div className="flex gap-4">
          <div className="flex-1">
            <Label>Tarjeta a pagar</Label>
            <Select
              required
              value={cardId}
              onChange={(e) => {
                setCardId(e.target.value);
                setCardCurrency("");
              }}
            >
              <option value="">Elegir...</option>
              {cards?.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </Select>
          </div>
          {cardCurrencyAccounts.length > 1 && (
            <div className="flex-1">
              <Label>Moneda</Label>
              <Select required value={cardCurrency} onChange={(e) => setCardCurrency(e.target.value)}>
                <option value="">Elegir...</option>
                {cardCurrencyAccounts.map((a) => (
                  <option key={a.id} value={a.currency}>
                    {a.currency}
                  </option>
                ))}
              </Select>
            </div>
          )}
        </div>
      )}
      {isCardPayment && cardId && cardCurrencyAccounts.length === 0 && (
        <p className="text-on-surface-variant text-xs -mt-2">
          Esa tarjeta todavía no tiene saldo cargado en ninguna moneda.
        </p>
      )}

      {isTransfer && !isCardPayment && (
        <div>
          <Label>Cuenta destino</Label>
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
              No hay otra cuenta en la misma moneda todavía.
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
