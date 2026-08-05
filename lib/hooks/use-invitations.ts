"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { useAuthUserId } from "@/lib/hooks/use-auth-user-id";
import type { Tables } from "@/types/supabase";

export type HouseholdInvitation = Tables<"household_invitations">;
export type InvitationRole = "admin" | "member" | "viewer";

export function useHouseholdInvitations() {
  const userId = useAuthUserId();

  return useQuery({
    queryKey: ["household-invitations", userId],
    enabled: !!userId,
    queryFn: async () => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("household_invitations")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });
}

export function useCreateInvitation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      householdId,
      email,
      role,
      message,
    }: {
      householdId: string;
      email: string;
      role: InvitationRole;
      message?: string;
    }) => {
      const supabase = createClient();
      const { data: invitation, error } = await supabase.rpc(
        "create_household_invitation",
        {
          target_household_id: householdId,
          target_email: email,
          target_role: role,
          target_message: message ?? undefined,
        },
      );
      if (error) throw error;

      const sendRes = await fetch("/api/invitations/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ invitationId: invitation.id }),
      });
      const sendBody = await sendRes.json().catch(() => ({}));
      if (!sendRes.ok) {
        throw new Error(sendBody.error ?? "No se pudo enviar la invitación");
      }

      return { invitation, ...sendBody } as {
        invitation: HouseholdInvitation;
        delivered: boolean;
        inviteLink: string;
      };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["household-invitations"] });
    },
  });
}

export function useCancelInvitation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (invitationId: string) => {
      const supabase = createClient();
      const { error } = await supabase
        .from("household_invitations")
        .update({ status: "cancelled" })
        .eq("id", invitationId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["household-invitations"] });
    },
  });
}

export function useResendInvitation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (invitationId: string) => {
      const supabase = createClient();
      const { error } = await supabase
        .from("household_invitations")
        .update({
          status: "pending",
          expires_at: new Date(
            Date.now() + 7 * 24 * 60 * 60 * 1000,
          ).toISOString(),
        })
        .eq("id", invitationId);
      if (error) throw error;

      const sendRes = await fetch("/api/invitations/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ invitationId }),
      });
      const sendBody = await sendRes.json().catch(() => ({}));
      if (!sendRes.ok) {
        throw new Error(sendBody.error ?? "No se pudo reenviar la invitación");
      }
      return sendBody as { delivered: boolean; inviteLink: string };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["household-invitations"] });
    },
  });
}

export function useInvitationPreview(token: string | null) {
  return useQuery({
    queryKey: ["invitation-preview", token],
    enabled: !!token,
    queryFn: async () => {
      const supabase = createClient();
      const { data, error } = await supabase
        .rpc("get_invitation_preview", { target_token: token as string })
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });
}

export function useAcceptInvitation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (token: string) => {
      const supabase = createClient();
      const { data, error } = await supabase.rpc(
        "accept_household_invitation",
        { target_token: token },
      );
      if (error) throw error;
      return data as string;
    },
    onSuccess: () => {
      queryClient.clear();
    },
  });
}
