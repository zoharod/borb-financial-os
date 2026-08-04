"use client";

import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input, Select, Label } from "@/components/ui/input";
import { useCurrentHousehold } from "@/lib/hooks/use-current-household";
import {
  useAccounts,
  useCreateAccount,
  useDeleteAccount,
  useUpdateAccount,
  type Account,
} from "@/lib/hooks/use-accounts";
import { CURRENCIES, ACCOUNT_TYPES as TYPES } from "@/lib/constants";

export default function AccountsPage() {
  const { data: household } = useCurrentHousehold();
  const { data: accounts, isLoading } = useAccounts();
  const createAccount = useCreateAccount();

  const [name, setName] = useState("");
  const [currency, setCurrency] = useState<(typeof CURRENCIES)[number]>("HNL");
  const [type, setType] = useState<(typeof TYPES)[number]["value"]>("checking");
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!household) {
      setError("No se encontró tu household todavía.");
      return;
    }

    try {
      await createAccount.mutateAsync({
        household_id: household.household_id,
        name,
        currency,
        type,
      });
      setName("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al crear la cuenta");
    }
  }

  return (
    <div className="max-w-2xl">
      <h1 className="text-xl font-semibold text-on-surface mb-6">Cuentas</h1>

      <Card className="mb-6">
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
            </div>
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
          </div>

          {error && (
            <p className="text-sm text-error" role="alert">
              {error}
            </p>
          )}

          <Button type="submit" disabled={createAccount.isPending}>
            {createAccount.isPending ? "Creando..." : "Agregar cuenta"}
          </Button>
        </form>
      </Card>

      {isLoading ? (
        <p className="text-on-surface-variant text-sm">Cargando...</p>
      ) : accounts && accounts.length > 0 ? (
        <ul className="space-y-3">
          {accounts.map((account: Account) => (
            <li key={account.id}>
              <AccountRow account={account} />
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-on-surface-variant text-sm">
          No hay cuentas todavía. Agregá la primera arriba.
        </p>
      )}
    </div>
  );
}

function AccountRow({ account }: { account: Account }) {
  const updateAccount = useUpdateAccount();
  const deleteAccount = useDeleteAccount();

  const [isEditing, setIsEditing] = useState(false);
  const [name, setName] = useState(account.name);
  const [currency, setCurrency] = useState<(typeof CURRENCIES)[number]>(
    account.currency as (typeof CURRENCIES)[number],
  );
  const [type, setType] = useState<(typeof TYPES)[number]["value"]>(
    account.type as (typeof TYPES)[number]["value"],
  );
  const [error, setError] = useState<string | null>(null);

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

  return (
    <Card className="flex items-center justify-between py-4">
      <div>
        <p className="text-on-surface font-medium">{account.name}</p>
        <p className="text-on-surface-variant text-sm font-mono">
          {account.currency} ·{" "}
          {TYPES.find((t) => t.value === account.type)?.label ?? account.type}
        </p>
      </div>
      <div className="flex gap-2">
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
