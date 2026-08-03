"use client";

import { useState } from "react";
import {
  useCreateHousehold,
  useCurrentHousehold,
} from "@/lib/hooks/use-current-household";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";

// Un usuario recién logueado (ej. primera vez con Google) no pertenece a
// ningún household todavía. Este guard le pide crear uno antes de mostrar
// el resto de la app — ver architecture.md "Registro / Onboarding".
export function HouseholdGuard({ children }: { children: React.ReactNode }) {
  const { data: household, isLoading } = useCurrentHousehold();
  const createHousehold = useCreateHousehold();

  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await createHousehold.mutateAsync(name);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Error al crear el household",
      );
    }
  }

  if (isLoading) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <p className="text-on-surface-variant text-sm">Cargando...</p>
      </div>
    );
  }

  if (!household) {
    return (
      <div className="flex flex-1 items-center justify-center px-5">
        <Card className="w-full max-w-sm">
          <h1 className="text-xl font-semibold text-on-surface mb-1">
            Nombrá tu hogar
          </h1>
          <p className="text-sm text-on-surface-variant mb-6">
            Es la primera vez que entrás — creá tu household para empezar.
            Después podés invitar a otra persona a compartirlo.
          </p>
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
            {error && (
              <p className="text-sm text-error" role="alert">
                {error}
              </p>
            )}
            <Button type="submit" disabled={createHousehold.isPending}>
              {createHousehold.isPending ? "Creando..." : "Crear"}
            </Button>
          </form>
        </Card>
      </div>
    );
  }

  return <>{children}</>;
}
