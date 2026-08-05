"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { StepShell } from "./step-shell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { Input, Select, Label } from "@/components/ui/input";
import { useCurrentHousehold } from "@/lib/hooks/use-current-household";
import { useCards, useCreateCard } from "@/lib/hooks/use-cards";
import { useCreateAccount } from "@/lib/hooks/use-accounts";
import { useCreateTransaction } from "@/lib/hooks/use-transactions";
import { useHouseholdMembers } from "@/lib/hooks/use-household-members";
import { CARD_NETWORKS } from "@/lib/constants";
import { todayISO } from "@/lib/date";

type HouseholdRow = { base_currency_default: string; secondary_currency: string | null };

function getHouseholdRow(
  household: ReturnType<typeof useCurrentHousehold>["data"],
): HouseholdRow | null {
  if (!household) return null;
  return household.households as unknown as HouseholdRow | null;
}

function memberLabel(member: {
  user_id: string;
  profiles: { full_name: string | null } | null;
}) {
  return member.profiles?.full_name || "Sin nombre";
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
  const { data: members } = useHouseholdMembers();
  const createCard = useCreateCard();
  const createAccount = useCreateAccount();
  const createTransaction = useCreateTransaction();

  const householdRow = getHouseholdRow(household);
  const primaryCurrency = householdRow?.base_currency_default ?? "HNL";
  const secondaryCurrency = householdRow?.secondary_currency ?? null;

  const [name, setName] = useState("");
  const [bank, setBank] = useState("");
  const [cardholderUserId, setCardholderUserId] = useState("");
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
  const [error, setError] = useState<string | null>(null);

  // Estado real del estado de cuenta subido (antes solo había un flag booleano
  // que ni guardaba el archivo) — ver domain.md "Subida de estado de cuenta".
  const [statementFile, setStatementFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  function clearStatementFile() {
    setStatementFile(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function resetForm() {
    setName("");
    setBank("");
    setCardholderUserId("");
    setLast4("");
    setCreditLimit("");
    setStatementClosingDay("");
    setPaymentDueDay("");
    setBalancePrimary("");
    setBalanceSecondary("");
    setMinimumPayment("");
    setFullPaymentAmount("");
    // Nunca debe sobrevivir a la tarjeta que se acaba de crear: si no se
    // limpia acá, el archivo de la tarjeta anterior parecería aplicar a la
    // siguiente que el usuario empiece a cargar.
    clearStatementFile();
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
        cardholder_user_id: cardholderUserId || null,
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

      // La tarjeta y los datos extraídos ya quedaron guardados arriba — acá
      // solo se limpia el formulario (incluido el archivo) para la próxima.
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
      total={7}
      title="Agregá tus tarjetas de crédito"
      description="Es opcional — si no usás tarjetas todavía, tocá Continuar sin agregar ninguna."
      onBack={onBack}
      wide
    >
      <Card className="mb-6">
        <p className="text-sm text-on-surface-variant mb-3">
          Subir tu último estado de cuenta (opcional)
        </p>

        {!statementFile ? (
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf,image/*"
            onChange={(e) => setStatementFile(e.target.files?.[0] ?? null)}
            className="block w-full text-sm text-on-surface-variant file:mr-4 file:rounded-full file:border-0 file:bg-surface-container-high file:px-4 file:py-2 file:text-on-surface"
          />
        ) : (
          <div className="flex items-center justify-between gap-3 rounded-lg border border-outline-variant/40 bg-surface-container-low px-4 py-3">
            <div className="flex items-center gap-3 min-w-0">
              <Icon name="description" className="text-on-surface-variant flex-shrink-0" />
              <div className="min-w-0">
                <p className="text-sm text-on-surface truncate">{statementFile.name}</p>
                <p className="text-xs text-on-surface-variant">
                  Subido · extracción automática no disponible todavía
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              <Button
                type="button"
                variant="secondary"
                onClick={() => fileInputRef.current?.click()}
              >
                Reemplazar
              </Button>
              <Button type="button" variant="danger" onClick={clearStatementFile}>
                Quitar
              </Button>
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,image/*"
                onChange={(e) => setStatementFile(e.target.files?.[0] ?? null)}
                className="hidden"
              />
            </div>
          </div>
        )}

        {statementFile && (
          <p className="text-xs text-on-surface-variant mt-2">
            Todavía no extraemos datos automáticamente de estados de cuenta —
            completá los campos manualmente abajo. El archivo no se guarda; es
            solo para que tengas el estado a mano mientras cargás los datos.
          </p>
        )}
      </Card>

      <form onSubmit={handleAdd} className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-4 mb-6">
        <div>
          <Label>Nombre de la tarjeta</Label>
          <Input
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Visa Signature, ..."
          />
        </div>
        <div>
          <Label>Banco</Label>
          <Input value={bank} onChange={(e) => setBank(e.target.value)} />
        </div>

        <div>
          <Label>Tarjetahabiente</Label>
          <Select
            value={cardholderUserId}
            onChange={(e) => setCardholderUserId(e.target.value)}
          >
            <option value="">Sin asignar</option>
            {members?.map((m) => (
              <option key={m.user_id} value={m.user_id}>
                {memberLabel(m)}
              </option>
            ))}
          </Select>
          {members && members.length <= 1 && (
            <p className="text-xs text-on-surface-variant mt-1">
              Todavía sos el único miembro del hogar.{" "}
              <Link href="/household" className="underline hover:text-on-surface">
                Invitá a alguien
              </Link>{" "}
              para poder asignarle tarjetas.
            </p>
          )}
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
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
          <div>
            <Label>Últimos 4</Label>
            <Input
              maxLength={4}
              value={last4}
              onChange={(e) => setLast4(e.target.value)}
            />
          </div>
        </div>

        <div>
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
          <div>
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

        <div>
          <Label>Límite de crédito (opcional)</Label>
          <Input
            type="number"
            step="0.01"
            value={creditLimit}
            onChange={(e) => setCreditLimit(e.target.value)}
          />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label>Día de corte (opcional)</Label>
            <Input
              type="number"
              min="1"
              max="31"
              value={statementClosingDay}
              onChange={(e) => setStatementClosingDay(e.target.value)}
            />
          </div>
          <div>
            <Label>Día de pago (opcional)</Label>
            <Input
              type="number"
              min="1"
              max="31"
              value={paymentDueDay}
              onChange={(e) => setPaymentDueDay(e.target.value)}
            />
          </div>
        </div>

        <div>
          <Label>Pago mínimo (opcional)</Label>
          <Input
            type="number"
            step="0.01"
            value={minimumPayment}
            onChange={(e) => setMinimumPayment(e.target.value)}
          />
        </div>
        <div>
          <Label>Pago de contado (opcional)</Label>
          <Input
            type="number"
            step="0.01"
            value={fullPaymentAmount}
            onChange={(e) => setFullPaymentAmount(e.target.value)}
          />
        </div>

        {error && (
          <p className="text-sm text-error sm:col-span-2" role="alert">
            {error}
          </p>
        )}

        <Button
          type="submit"
          variant="secondary"
          disabled={isSaving}
          className="sm:col-span-2"
        >
          {isSaving ? "Agregando..." : "Agregar tarjeta"}
        </Button>
      </form>

      {cards && cards.length > 0 && (
        <ul className="space-y-2 mb-6">
          {cards.map((c) => {
            const cardholder = members?.find((m) => m.user_id === c.cardholder_user_id);
            return (
              <li key={c.id}>
                <Card className="py-3">
                  <p className="text-on-surface font-medium">{c.name}</p>
                  <p className="text-on-surface-variant text-xs font-mono">
                    {c.bank ?? "Sin banco"} ·{" "}
                    {CARD_NETWORKS.find((n) => n.value === c.network)?.label ??
                      c.network}
                    {cardholder
                      ? ` · ${memberLabel(cardholder)}`
                      : c.legacy_cardholder_name
                        ? ` · ${c.legacy_cardholder_name} (sin vincular)`
                        : ""}
                  </p>
                </Card>
              </li>
            );
          })}
        </ul>
      )}

      <Button onClick={onContinue}>Continuar</Button>
    </StepShell>
  );
}
