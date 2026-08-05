"use client";

import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  useHouseholdInvitations,
  useCancelInvitation,
  useResendInvitation,
  type HouseholdInvitation,
} from "@/lib/hooks/use-invitations";
import { HOUSEHOLD_ROLES } from "@/lib/constants";

export function PendingInvitations() {
  const { data: invitations, isLoading } = useHouseholdInvitations();
  const pending = (invitations ?? []).filter((i) => i.status !== "accepted");

  if (isLoading || pending.length === 0) return null;

  return (
    <Card>
      <p className="font-mono text-xs uppercase tracking-wider text-on-surface-variant mb-4">
        Invitaciones pendientes
      </p>
      <ul className="flex flex-col gap-3">
        {pending.map((invitation) => (
          <InvitationRow key={invitation.id} invitation={invitation} />
        ))}
      </ul>
    </Card>
  );
}

function statusLabel(invitation: HouseholdInvitation) {
  if (invitation.status === "cancelled") return "Cancelada";
  if (invitation.status === "expired") return "Expirada";
  if (new Date(invitation.expires_at) < new Date()) return "Expirada";
  return "Pendiente";
}

function InvitationRow({ invitation }: { invitation: HouseholdInvitation }) {
  const cancelInvitation = useCancelInvitation();
  const resendInvitation = useResendInvitation();
  const [error, setError] = useState<string | null>(null);
  const [copiedLink, setCopiedLink] = useState<string | null>(null);

  const roleLabel =
    HOUSEHOLD_ROLES.find((r) => r.value === invitation.role)?.label ??
    invitation.role;
  const status = statusLabel(invitation);
  const isActive = invitation.status === "pending" && status === "Pendiente";

  async function handleCancel() {
    setError(null);
    try {
      await cancelInvitation.mutateAsync(invitation.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo cancelar");
    }
  }

  async function handleResend() {
    setError(null);
    setCopiedLink(null);
    try {
      const res = await resendInvitation.mutateAsync(invitation.id);
      if (!res.delivered) setCopiedLink(res.inviteLink);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo reenviar");
    }
  }

  return (
    <li className="flex flex-col gap-2 py-2 border-b border-outline-variant/10 last:border-0">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-on-surface truncate">{invitation.email}</p>
          <p className="text-on-surface-variant text-xs">
            {roleLabel} · {status}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <Button
            variant="secondary"
            onClick={handleResend}
            disabled={resendInvitation.isPending}
          >
            Reenviar
          </Button>
          {isActive && (
            <Button
              variant="danger"
              onClick={handleCancel}
              disabled={cancelInvitation.isPending}
            >
              Cancelar
            </Button>
          )}
        </div>
      </div>
      {copiedLink && (
        <p className="text-xs text-on-surface-variant break-all">
          Ya tiene cuenta, compartile este link: {copiedLink}
        </p>
      )}
      {error && (
        <p className="text-sm text-error" role="alert">
          {error}
        </p>
      )}
    </li>
  );
}
