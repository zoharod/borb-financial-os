"use client";

import { use, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useAuthUserId } from "@/lib/hooks/use-auth-user-id";
import {
  useInvitationPreview,
  useAcceptInvitation,
} from "@/lib/hooks/use-invitations";
import { HOUSEHOLD_ROLES } from "@/lib/constants";

export default function InvitePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = use(params);
  const router = useRouter();
  const userId = useAuthUserId();
  const { data: preview, isLoading } = useInvitationPreview(token);
  const acceptInvitation = useAcceptInvitation();
  const [error, setError] = useState<string | null>(null);

  async function handleAccept() {
    setError(null);
    try {
      await acceptInvitation.mutateAsync(token);
      router.push("/dashboard");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo aceptar la invitación");
    }
  }

  return (
    <main className="flex flex-1 items-center justify-center px-5">
      <Card className="w-full max-w-sm">
        <h1 className="text-xl font-semibold text-on-surface mb-1">
          Borb Financial OS
        </h1>

        {isLoading || userId === undefined ? (
          <p className="text-on-surface-variant text-sm mt-4">Cargando...</p>
        ) : !preview ? (
          <p className="text-on-surface-variant text-sm mt-4">
            Esta invitación no existe o el link está mal.
          </p>
        ) : preview.status === "accepted" ? (
          <p className="text-on-surface-variant text-sm mt-4">
            Esta invitación ya fue utilizada.
          </p>
        ) : preview.status === "cancelled" ? (
          <p className="text-on-surface-variant text-sm mt-4">
            Esta invitación fue cancelada. Pedile a quien te invitó que te
            mande una nueva.
          </p>
        ) : preview.status === "expired" ? (
          <p className="text-on-surface-variant text-sm mt-4">
            Esta invitación expiró. Pedile a quien te invitó que la reenvíe.
          </p>
        ) : (
          <div className="mt-4 flex flex-col gap-4">
            <div>
              <p className="text-on-surface">
                {preview.invited_by_name ?? "Alguien"} te invitó a sumarte a{" "}
                <span className="font-medium">{preview.household_name}</span>
              </p>
              <p className="text-on-surface-variant text-sm">
                Rol:{" "}
                {HOUSEHOLD_ROLES.find((r) => r.value === preview.role)?.label ??
                  preview.role}
              </p>
              {preview.message && (
                <p className="text-on-surface-variant text-sm mt-2 italic">
                  &ldquo;{preview.message}&rdquo;
                </p>
              )}
            </div>

            {error && (
              <p className="text-sm text-error" role="alert">
                {error}
              </p>
            )}

            {userId ? (
              <Button onClick={handleAccept} disabled={acceptInvitation.isPending}>
                {acceptInvitation.isPending ? "Uniéndote..." : "Aceptar invitación"}
              </Button>
            ) : (
              <Button
                onClick={() =>
                  router.push(`/login?next=${encodeURIComponent(`/invite/${token}`)}`)
                }
              >
                Iniciar sesión para aceptar
              </Button>
            )}

            <Link
              href="/dashboard"
              className="text-on-surface-variant text-xs text-center hover:text-on-surface"
            >
              Ahora no
            </Link>
          </div>
        )}
      </Card>
    </main>
  );
}
