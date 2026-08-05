"use client";

import { useState } from "react";
import { StepShell } from "./step-shell";
import { Button } from "@/components/ui/button";
import { Input, Select, Label } from "@/components/ui/input";
import {
  useCreateHousehold,
  useUpdateHouseholdSettings,
} from "@/lib/hooks/use-current-household";
import { CURRENCIES } from "@/lib/constants";

type ExistingHousehold = {
  householdId: string;
  name: string;
  primaryCurrency: (typeof CURRENCIES)[number];
  secondaryCurrency: (typeof CURRENCIES)[number] | null;
};

// Con `existing` se llega acá por el botón Atrás desde Cuentas (no por
// primera vez) — el hogar ya existe, así que en vez de re-crearlo se edita.
// Ningún dato de pasos posteriores se pierde: cuentas/tarjetas/presupuesto ya
// están guardados en la base, no dependen de este componente.
export function HouseholdStep({
  onCreated,
  existing,
  onContinue,
}: {
  onCreated: () => void;
  existing?: ExistingHousehold;
  onContinue?: () => void;
}) {
  const createHousehold = useCreateHousehold();
  const updateHousehold = useUpdateHouseholdSettings();

  const [name, setName] = useState(existing?.name ?? "");
  const [primaryCurrency, setPrimaryCurrency] = useState<
    (typeof CURRENCIES)[number]
  >(existing?.primaryCurrency ?? "HNL");
  const [secondaryCurrency, setSecondaryCurrency] = useState<
    (typeof CURRENCIES)[number] | ""
  >(existing?.secondaryCurrency ?? "");
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      if (existing) {
        await updateHousehold.mutateAsync({
          householdId: existing.householdId,
          name,
          base_currency_default: primaryCurrency,
          secondary_currency: secondaryCurrency || null,
        });
        onContinue?.();
      } else {
        await createHousehold.mutateAsync({
          name,
          primaryCurrency,
          secondaryCurrency: secondaryCurrency || null,
        });
        onCreated();
      }
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Error al guardar el hogar",
      );
    }
  }

  const isSaving = existing ? updateHousehold.isPending : createHousehold.isPending;
  const otherCurrency = CURRENCIES.find((c) => c !== primaryCurrency)!;

  return (
    <StepShell
      step={1}
      total={7}
      title={existing ? "Datos de tu hogar" : "Nombrá tu hogar"}
      description={
        existing
          ? "Podés ajustar el nombre o las monedas antes de seguir."
          : "Es la primera vez que entrás. Después vas a poder invitar a otra persona a compartirlo."
      }
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div>
          <Label>Nombre del hogar</Label>
          <Input
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Casa Zohar, ..."
          />
        </div>

        <div>
          <Label>Moneda principal</Label>
          <Select
            value={primaryCurrency}
            onChange={(e) => {
              const value = e.target.value as (typeof CURRENCIES)[number];
              setPrimaryCurrency(value);
              if (secondaryCurrency === value) setSecondaryCurrency("");
            }}
          >
            {CURRENCIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </Select>
        </div>

        <div>
          <Label>Moneda secundaria (opcional)</Label>
          <Select
            value={secondaryCurrency}
            onChange={(e) =>
              setSecondaryCurrency(
                e.target.value as (typeof CURRENCIES)[number] | "",
              )
            }
          >
            <option value="">Ninguna — solo uso {primaryCurrency}</option>
            <option value={otherCurrency}>
              También uso {otherCurrency}
            </option>
          </Select>
        </div>

        {error && (
          <p className="text-sm text-error" role="alert">
            {error}
          </p>
        )}

        <Button type="submit" disabled={isSaving}>
          {isSaving ? "Guardando..." : "Continuar"}
        </Button>
      </form>
    </StepShell>
  );
}
