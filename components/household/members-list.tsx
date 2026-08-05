"use client";

import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/input";
import {
  useHouseholdMembers,
  useHouseholdMemberEmails,
  useChangeMemberRole,
  useRemoveMember,
  type HouseholdMember,
  type HouseholdMemberRole,
} from "@/lib/hooks/use-household-members";
import { HOUSEHOLD_ROLES } from "@/lib/constants";

export function MembersList({
  householdId,
  currentUserId,
  canManage,
  isOwner,
}: {
  householdId: string;
  currentUserId: string;
  canManage: boolean;
  isOwner: boolean;
}) {
  const { data: members, isLoading } = useHouseholdMembers();
  const { data: emails } = useHouseholdMemberEmails(householdId);

  return (
    <Card>
      <p className="font-mono text-xs uppercase tracking-wider text-on-surface-variant mb-4">
        Miembros del hogar
      </p>
      {isLoading ? (
        <p className="text-on-surface-variant text-sm">Cargando...</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {members?.map((member) => (
            <MemberRow
              key={member.id}
              member={member}
              email={emails?.[member.user_id] ?? null}
              isSelf={member.user_id === currentUserId}
              canManage={canManage}
              isOwner={isOwner}
            />
          ))}
        </ul>
      )}
    </Card>
  );
}

function MemberRow({
  member,
  email,
  isSelf,
  canManage,
  isOwner,
}: {
  member: HouseholdMember;
  email: string | null;
  isSelf: boolean;
  canManage: boolean;
  isOwner: boolean;
}) {
  const changeRole = useChangeMemberRole();
  const removeMember = useRemoveMember();
  const [error, setError] = useState<string | null>(null);

  const roleLabel =
    HOUSEHOLD_ROLES.find((r) => r.value === member.role)?.label ?? member.role;

  // Admin puede cambiar member/viewer pero no ascender a otro a admin (ver
  // policy "owner or admin can change other members role") — se refleja acá
  // ocultando esa opción cuando corresponde, aunque la RLS es la que de
  // verdad lo hace cumplir.
  const assignableRoles = isOwner
    ? HOUSEHOLD_ROLES.filter((r) => r.value !== "owner")
    : HOUSEHOLD_ROLES.filter((r) => r.value === "member" || r.value === "viewer");

  const canActOnThisMember = canManage && !isSelf && member.role !== "owner";

  async function handleRoleChange(role: HouseholdMemberRole) {
    setError(null);
    try {
      await changeRole.mutateAsync({ memberId: member.id, role });
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo cambiar el rol");
    }
  }

  async function handleRemove() {
    if (!confirm(`¿Quitar a ${member.profiles?.full_name ?? email ?? "este miembro"} del hogar?`))
      return;
    setError(null);
    try {
      await removeMember.mutateAsync(member.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo remover al miembro");
    }
  }

  return (
    <li className="flex items-center justify-between gap-3 py-2 border-b border-outline-variant/10 last:border-0">
      <div className="flex items-center gap-3 min-w-0">
        {member.profiles?.avatar_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={member.profiles.avatar_url}
            alt=""
            className="h-9 w-9 rounded-full object-cover flex-shrink-0"
          />
        ) : (
          <div className="h-9 w-9 rounded-full bg-surface-container-lowest flex items-center justify-center text-on-surface-variant text-sm flex-shrink-0">
            {(member.profiles?.full_name ?? email ?? "?")[0]?.toUpperCase()}
          </div>
        )}
        <div className="min-w-0">
          <p className="text-on-surface truncate">
            {member.profiles?.full_name ?? "Sin nombre"}
            {isSelf && (
              <span className="text-on-surface-variant text-xs ml-1">(vos)</span>
            )}
          </p>
          <p className="text-on-surface-variant text-xs truncate">{email}</p>
        </div>
      </div>

      <div className="flex items-center gap-2 flex-shrink-0">
        {canActOnThisMember ? (
          <Select
            value={member.role}
            onChange={(e) =>
              handleRoleChange(e.target.value as HouseholdMemberRole)
            }
            className="text-sm"
          >
            {assignableRoles.map((r) => (
              <option key={r.value} value={r.value}>
                {r.label}
              </option>
            ))}
          </Select>
        ) : (
          <span className="text-on-surface-variant text-sm font-mono">
            {roleLabel}
          </span>
        )}
        {canActOnThisMember && (
          <Button variant="danger" onClick={handleRemove}>
            Quitar
          </Button>
        )}
      </div>
      {error && (
        <p className="text-sm text-error basis-full" role="alert">
          {error}
        </p>
      )}
    </li>
  );
}
