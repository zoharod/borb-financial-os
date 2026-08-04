"use client";

import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input, Select, Label } from "@/components/ui/input";
import {
  useCreateHousehold,
  useCurrentHousehold,
} from "@/lib/hooks/use-current-household";
import { useAccounts, useCreateAccount } from "@/lib/hooks/use-accounts";
import { useCategories, useCreateCategory } from "@/lib/hooks/use-categories";
import { CURRENCIES, ACCOUNT_TYPES, SUGGESTED_CATEGORIES } from "@/lib/constants";

function StepShell({
  step,
  total,
  title,
  description,
  children,
}: {
  step: number;
  total: number;
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-1 items-center justify-center px-5">
      <Card className="w-full max-w-sm">
        <p className="font-mono text-xs uppercase tracking-wider text-on-surface-variant mb-3">
          Paso {step} de {total}
        </p>
        <h1 className="text-xl font-semibold text-on-surface mb-1">{title}</h1>
        <p className="text-sm text-on-surface-variant mb-6">{description}</p>
        {children}
      </Card>
    </div>
  );
}

// Onboarding guiado para un usuario nuevo: sin esto, después de crear el
// household caía directo a un dashboard vacío sin ninguna pista de qué
// cargar primero. Tres pasos en orden de dependencia real (una transacción
// necesita una cuenta; un presupuesto necesita una categoría): household →
// primera cuenta → categorías. Presupuesto queda para después (Fase 1 ya lo
// resuelve bien desde su propia página, no hace falta forzarlo acá).
export function OnboardingGuard({ children }: { children: React.ReactNode }) {
  const { data: household, isLoading: loadingHousehold } = useCurrentHousehold();
  const { data: accounts, isLoading: loadingAccounts } = useAccounts();
  const { data: categories, isLoading: loadingCategories } = useCategories();

  const createHousehold = useCreateHousehold();
  const createAccount = useCreateAccount();
  const createCategory = useCreateCategory();

  const [householdName, setHouseholdName] = useState("");
  const [accountName, setAccountName] = useState("");
  const [accountCurrency, setAccountCurrency] =
    useState<(typeof CURRENCIES)[number]>("HNL");
  const [accountType, setAccountType] =
    useState<(typeof ACCOUNT_TYPES)[number]["value"]>("checking");
  const [customCategory, setCustomCategory] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function handleCreateHousehold(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await createHousehold.mutateAsync(householdName);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Error al crear el household",
      );
    }
  }

  async function handleCreateAccount(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!household) return;
    try {
      await createAccount.mutateAsync({
        household_id: household.household_id,
        name: accountName,
        currency: accountCurrency,
        type: accountType,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al crear la cuenta");
    }
  }

  async function handleAddSuggestedCategory(name: string) {
    if (!household) return;
    setError(null);
    try {
      await createCategory.mutateAsync({
        household_id: household.household_id,
        name,
        is_extra_default: name === "Extras/Imprevistos",
      });
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Error al crear la categoría",
      );
    }
  }

  async function handleAddCustomCategory(e: React.FormEvent) {
    e.preventDefault();
    if (!customCategory.trim()) return;
    await handleAddSuggestedCategory(customCategory.trim());
    setCustomCategory("");
  }

  if (loadingHousehold || loadingAccounts || loadingCategories) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <p className="text-on-surface-variant text-sm">Cargando...</p>
      </div>
    );
  }

  if (!household) {
    return (
      <StepShell
        step={1}
        total={3}
        title="Nombrá tu hogar"
        description="Es la primera vez que entrás. Después podés invitar a otra persona a compartirlo."
      >
        <form onSubmit={handleCreateHousehold} className="flex flex-col gap-4">
          <div>
            <Label>Nombre del hogar</Label>
            <Input
              required
              value={householdName}
              onChange={(e) => setHouseholdName(e.target.value)}
              placeholder="Casa Zohar, ..."
            />
          </div>
          {error && (
            <p className="text-sm text-error" role="alert">
              {error}
            </p>
          )}
          <Button type="submit" disabled={createHousehold.isPending}>
            {createHousehold.isPending ? "Creando..." : "Crear"}
          </Button>
        </form>
      </StepShell>
    );
  }

  if (!accounts || accounts.length === 0) {
    return (
      <StepShell
        step={2}
        total={3}
        title="Agregá tu primera cuenta"
        description="Una cuenta de banco, efectivo, o lo que uses para pagar. Podés agregar más después desde Cuentas."
      >
        <form onSubmit={handleCreateAccount} className="flex flex-col gap-4">
          <div>
            <Label>Nombre</Label>
            <Input
              required
              value={accountName}
              onChange={(e) => setAccountName(e.target.value)}
              placeholder="Pagos L, Ahorro $, ..."
            />
          </div>
          <div className="flex gap-4">
            <div className="flex-1">
              <Label>Moneda</Label>
              <Select
                value={accountCurrency}
                onChange={(e) =>
                  setAccountCurrency(e.target.value as (typeof CURRENCIES)[number])
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
                value={accountType}
                onChange={(e) =>
                  setAccountType(
                    e.target.value as (typeof ACCOUNT_TYPES)[number]["value"],
                  )
                }
              >
                {ACCOUNT_TYPES.map((t) => (
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
            {createAccount.isPending ? "Creando..." : "Continuar"}
          </Button>
        </form>
      </StepShell>
    );
  }

  if (!categories || categories.length === 0) {
    return (
      <StepShell
        step={3}
        total={3}
        title="Agregá categorías"
        description="Tocá las que uses para clasificar gastos (podés agregar o editar más después desde Categorías)."
      >
        <div className="flex flex-wrap gap-2 mb-4">
          {[...SUGGESTED_CATEGORIES, "Extras/Imprevistos"].map((name) => (
            <button
              key={name}
              type="button"
              onClick={() => handleAddSuggestedCategory(name)}
              disabled={createCategory.isPending}
              className="rounded-full border border-outline-variant px-3 py-1.5 text-sm text-on-surface hover:bg-surface-container-high disabled:opacity-50"
            >
              + {name}
            </button>
          ))}
        </div>

        <form onSubmit={handleAddCustomCategory} className="flex gap-2 mb-4">
          <Input
            value={customCategory}
            onChange={(e) => setCustomCategory(e.target.value)}
            placeholder="Otra categoría..."
          />
          <Button type="submit" variant="secondary">
            Agregar
          </Button>
        </form>

        {error && (
          <p className="text-sm text-error mb-4" role="alert">
            {error}
          </p>
        )}

        <p className="text-xs text-on-surface-variant">
          Agregá al menos una para continuar.
        </p>
      </StepShell>
    );
  }

  return <>{children}</>;
}
