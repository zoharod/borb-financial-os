"use client";

import { useState } from "react";
import { StepShell } from "./step-shell";
import { Button } from "@/components/ui/button";
import { Input, Select, Label } from "@/components/ui/input";
import { useCreateHousehold } from "@/lib/hooks/use-current-household";
import { CURRENCIES } from "@/lib/constants";

export function HouseholdStep({ onCreated }: { onCreated: () => void }) {
  const createHousehold = useCreateHousehold();

  const [name, setName] = useState("");
  const [primaryCurrency, setPrimaryCurrency] =
    useState<(typeof CURRENCIES)[number]>("HNL");
  const [secondaryCurrency, setSecondaryCurrency] = useState<
    (typeof CURRENCIES)[number] | ""
  >("");
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await createHousehold.mutateAsync({
        name,
        primaryCurrency,
        secondaryCurrency: secondaryCurrency || null,
      });
      onCreated();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Error al crear el household",
      );
    }
  }

  const otherCurrency = CURRENCIES.find((c) => c !== primaryCurrency)!;

  return (
    <StepShell
      step={1}
      total={5}
      title="Nombrá tu hogar"
      description="Es la primera vez que entrás. Después vas a poder invitar a otra persona a compartirlo."
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

        <Button type="submit" disabled={createHousehold.isPending}>
          {createHousehold.isPending ? "Creando..." : "Continuar"}
        </Button>
      </form>
    </StepShell>
  );
}
