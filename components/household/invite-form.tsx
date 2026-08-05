"use client";

import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input, Select, Label } from "@/components/ui/input";
import { useCreateInvitation, type InvitationRole } from "@/lib/hooks/use-invitations";
import { INVITABLE_ROLES } from "@/lib/constants";

export function InviteForm({ householdId }: { householdId: string }) {
  const createInvitation = useCreateInvitation();
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<InvitationRole>("member");
  const [message, setMessage] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{
    delivered: boolean;
    inviteLink: string;
  } | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setResult(null);
    try {
      const res = await createInvitation.mutateAsync({
        householdId,
        email,
        role,
        message: message || undefined,
      });
      setResult({ delivered: res.delivered, inviteLink: res.inviteLink });
      setEmail("");
      setMessage("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo invitar");
    }
  }

  return (
    <Card>
      <p className="font-mono text-xs uppercase tracking-wider text-on-surface-variant mb-4">
        Invitar a alguien
      </p>
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div className="flex gap-4">
          <div className="flex-1">
            <Label>Email</Label>
            <Input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="persona@email.com"
            />
          </div>
          <div className="flex-1">
            <Label>Rol</Label>
            <Select
              value={role}
              onChange={(e) => setRole(e.target.value as InvitationRole)}
            >
              {INVITABLE_ROLES.map((r) => (
                <option key={r.value} value={r.value}>
                  {r.label}
                </option>
              ))}
            </Select>
          </div>
        </div>
        <div>
          <Label>Mensaje personal (opcional)</Label>
          <Input
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Sumate a nuestro hogar en Borb..."
          />
        </div>

        {error && (
          <p className="text-sm text-error" role="alert">
            {error}
          </p>
        )}

        <div>
          <Button type="submit" disabled={createInvitation.isPending}>
            {createInvitation.isPending ? "Invitando..." : "Enviar invitación"}
          </Button>
        </div>
      </form>

      {result && (
        <div className="mt-4 pt-4 border-t border-outline-variant/20">
          {result.delivered ? (
            <p className="text-sm text-secondary">
              Le mandamos un correo de invitación.
            </p>
          ) : (
            <div className="flex flex-col gap-2">
              <p className="text-sm text-on-surface-variant">
                Esa persona ya tiene una cuenta en Borb — no le podemos mandar
                un correo de invitación. Compartile este link directamente:
              </p>
              <div className="flex gap-2">
                <Input readOnly value={result.inviteLink} />
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => navigator.clipboard.writeText(result.inviteLink)}
                >
                  Copiar
                </Button>
              </div>
            </div>
          )}
        </div>
      )}
    </Card>
  );
}
