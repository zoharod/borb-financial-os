"use client";

import { Icon } from "@/components/ui/icon";
import { useAuthUserId } from "@/lib/hooks/use-auth-user-id";
import { useCurrentHousehold } from "@/lib/hooks/use-current-household";
import { MembersList } from "@/components/household/members-list";
import { InviteForm } from "@/components/household/invite-form";
import { PendingInvitations } from "@/components/household/pending-invitations";
import { HouseholdSettingsForm } from "@/components/household/household-settings-form";
import { OwnershipActions } from "@/components/household/ownership-actions";

export default function HouseholdPage() {
  const userId = useAuthUserId();
  const { data: household, isLoading } = useCurrentHousehold();

  if (isLoading || !household || !userId) {
    return <p className="text-on-surface-variant text-sm">Cargando...</p>;
  }

  const householdRow = household.households as unknown as {
    name: string;
    avatar_url: string | null;
    base_currency_default: string;
    secondary_currency: string | null;
    financial_month_start_day: number;
    default_budget_period: string;
  } | null;

  const isOwner = household.role === "owner";
  const canManageMembers = household.role === "owner" || household.role === "admin";

  if (!householdRow) return null;

  return (
    <div className="max-w-2xl flex flex-col gap-6">
      <h1 className="text-2xl font-bold text-on-surface tracking-tight flex items-center gap-2">
        <Icon name="home" className="text-primary" filled />
        Tu hogar
      </h1>

      <MembersList
        householdId={household.household_id}
        currentUserId={userId}
        canManage={canManageMembers}
        isOwner={isOwner}
      />

      {canManageMembers && <InviteForm householdId={household.household_id} />}
      {canManageMembers && <PendingInvitations />}

      <HouseholdSettingsForm
        householdId={household.household_id}
        name={householdRow.name}
        avatarUrl={householdRow.avatar_url}
        primaryCurrency={householdRow.base_currency_default}
        secondaryCurrency={householdRow.secondary_currency}
        financialMonthStartDay={householdRow.financial_month_start_day}
        defaultBudgetPeriod={householdRow.default_budget_period}
        canEdit={canManageMembers}
      />

      <OwnershipActions householdId={household.household_id} isOwner={isOwner} />
    </div>
  );
}
