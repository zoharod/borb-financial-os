"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { useAuthUserId } from "@/lib/hooks/use-auth-user-id";
import type { Tables } from "@/types/supabase";

export type HouseholdMemberRole = "owner" | "admin" | "member" | "viewer";

export type HouseholdMember = Tables<"household_members"> & {
  profiles: Pick<Tables<"profiles">, "full_name" | "avatar_url"> | null;
};

export function useHouseholdMembers() {
  const userId = useAuthUserId();

  return useQuery({
    queryKey: ["household-members", userId],
    enabled: !!userId,
    queryFn: async () => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("household_members")
        .select("*, profiles(full_name, avatar_url)")
        .order("joined_at", { ascending: true });
      if (error) throw error;
      return data as HouseholdMember[];
    },
  });
}

// auth.users no se expone vía PostgREST — el email de cada miembro viene de
// una función SECURITY DEFINER (get_household_member_emails), no de una
// tabla. Se pide aparte de useHouseholdMembers() para no acoplar esa query
// a esta.
export function useHouseholdMemberEmails(householdId: string | undefined) {
  return useQuery({
    queryKey: ["household-member-emails", householdId],
    enabled: !!householdId,
    queryFn: async () => {
      const supabase = createClient();
      const { data, error } = await supabase.rpc(
        "get_household_member_emails",
        { target_household_id: householdId as string },
      );
      if (error) throw error;
      return Object.fromEntries(
        (data ?? []).map((row) => [row.user_id, row.email]),
      ) as Record<string, string | null>;
    },
  });
}

function invalidateMembershipQueries(
  queryClient: ReturnType<typeof useQueryClient>,
) {
  queryClient.invalidateQueries({ queryKey: ["household-members"] });
  queryClient.invalidateQueries({ queryKey: ["current-household"] });
}

export function useChangeMemberRole() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      memberId,
      role,
    }: {
      memberId: string;
      role: HouseholdMemberRole;
    }) => {
      const supabase = createClient();
      const { error } = await supabase
        .from("household_members")
        .update({ role })
        .eq("id", memberId);
      if (error) throw error;
    },
    onSuccess: () => invalidateMembershipQueries(queryClient),
  });
}

export function useRemoveMember() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (memberId: string) => {
      const supabase = createClient();
      const { error } = await supabase.rpc("remove_household_member", {
        target_member_id: memberId,
      });
      if (error) throw error;
    },
    onSuccess: () => invalidateMembershipQueries(queryClient),
  });
}

export function useLeaveHousehold() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (householdId: string) => {
      const supabase = createClient();
      const { error } = await supabase.rpc("leave_household", {
        target_household_id: householdId,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      invalidateMembershipQueries(queryClient);
      queryClient.clear();
    },
  });
}

export function useTransferOwnership() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      householdId,
      newOwnerUserId,
    }: {
      householdId: string;
      newOwnerUserId: string;
    }) => {
      const supabase = createClient();
      const { error } = await supabase.rpc("transfer_household_ownership", {
        target_household_id: householdId,
        new_owner_user_id: newOwnerUserId,
      });
      if (error) throw error;
    },
    onSuccess: () => invalidateMembershipQueries(queryClient),
  });
}

export function useDeleteHousehold() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (householdId: string) => {
      const supabase = createClient();
      const { error } = await supabase.rpc("delete_household", {
        target_household_id: householdId,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.clear();
    },
  });
}
