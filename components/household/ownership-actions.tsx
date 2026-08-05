"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/input";
import {
  useHouseholdMembers,
  useTransferOwnership,
  useLeaveHousehold,
  useDeleteHousehold,
} from "@/lib/hooks/use-household-members";

export function OwnershipActions({
  householdId,
  isOwner,
}: {
  householdId: string;
  isOwner: boolean;
}) {
  const router = useRouter();
  const { data: members } = useHouseholdMembers();
  const transferOwnership = useTransferOwnership();
  const leaveHousehold = useLeaveHousehold();
  const deleteHousehold = useDeleteHousehold();

  const [newOwnerId, setNewOwnerId] = useState("");
  const [confirmingTransfer, setConfirmingTransfer] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [deleteText, setDeleteText] = useState("");
  const [error, setError] = useState<string | null>(null);

  const otherMembers = (members ?? []).filter((m) => m.role !== "owner");

  async function handleTransfer() {
    setError(null);
    try {
      await transferOwnership.mutateAsync({ householdId, newOwnerUserId: newOwnerId });
      setConfirmingTransfer(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo transferir");
    }
  }

  async function handleLeave() {
    if (!confirm("¿Salir de este hogar? Perdés acceso a sus datos financieros.")) return;
    setError(null);
    try {
      await leaveHousehold.mutateAsync(householdId);
      router.push("/login");
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo salir del hogar");
    }
  }

  async function handleDelete() {
    setError(null);
    try {
      await deleteHousehold.mutateAsync(householdId);
      router.push("/login");
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo eliminar el hogar");
    }
  }

  return (
    <Card className="border-error/40">
      <p className="font-mono text-xs uppercase tracking-wider text-error mb-4">
        Propiedad y zona de riesgo
      </p>
      <div className="flex flex-col gap-4">
        {isOwner && otherMembers.length > 0 && (
          <div>
            {!confirmingTransfer ? (
              <Button variant="secondary" onClick={() => setConfirmingTransfer(true)}>
                Transferir propiedad
              </Button>
            ) : (
              <div className="flex flex-col gap-2">
                <Select
                  value={newOwnerId}
                  onChange={(e) => setNewOwnerId(e.target.value)}
                >
                  <option value="">Elegí el nuevo dueño</option>
                  {otherMembers.map((m) => (
                    <option key={m.id} value={m.user_id}>
                      {m.profiles?.full_name ?? m.user_id}
                    </option>
                  ))}
                </Select>
                <div className="flex gap-2 justify-end">
                  <Button variant="secondary" onClick={() => setConfirmingTransfer(false)}>
                    Cancelar
                  </Button>
                  <Button
                    onClick={handleTransfer}
                    disabled={!newOwnerId || transferOwnership.isPending}
                  >
                    Confirmar transferencia
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}

        {!isOwner && (
          <Button variant="danger" onClick={handleLeave} disabled={leaveHousehold.isPending}>
            Salir del hogar
          </Button>
        )}

        {isOwner && (
          <div>
            {!confirmingDelete ? (
              <Button variant="danger" onClick={() => setConfirmingDelete(true)}>
                Eliminar hogar
              </Button>
            ) : (
              <div className="flex flex-col gap-2">
                <p className="text-sm text-on-surface-variant">
                  Esto elimina el hogar y TODOS sus datos financieros (cuentas,
                  tarjetas, transacciones, presupuesto) para todos sus
                  miembros, sin vuelta atrás. Escribí{" "}
                  <span className="font-mono text-on-surface">ELIMINAR</span>{" "}
                  para confirmar.
                </p>
                <input
                  className="w-full rounded-sm bg-surface-container-lowest px-3 py-2 text-on-surface outline-none focus:ring-2 focus:ring-error/30"
                  value={deleteText}
                  onChange={(e) => setDeleteText(e.target.value)}
                  placeholder="ELIMINAR"
                />
                <div className="flex gap-2 justify-end">
                  <Button variant="secondary" onClick={() => setConfirmingDelete(false)}>
                    Cancelar
                  </Button>
                  <Button
                    variant="danger"
                    disabled={deleteText !== "ELIMINAR" || deleteHousehold.isPending}
                    onClick={handleDelete}
                  >
                    Confirmar eliminación
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}

        {error && (
          <p className="text-sm text-error" role="alert">
            {error}
          </p>
        )}
      </div>
    </Card>
  );
}
