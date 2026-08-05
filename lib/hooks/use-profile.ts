"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { useAuthUserId } from "@/lib/hooks/use-auth-user-id";
import type { Tables, TablesUpdate } from "@/types/supabase";

export type Profile = Tables<"profiles">;

export function useProfile() {
  const userId = useAuthUserId();

  return useQuery({
    queryKey: ["profile", userId],
    enabled: !!userId,
    queryFn: async () => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", userId as string)
        .single();
      if (error) throw error;
      return data;
    },
  });
}

export function useUpdateProfile() {
  const queryClient = useQueryClient();
  const userId = useAuthUserId();
  return useMutation({
    mutationFn: async (updates: TablesUpdate<"profiles">) => {
      const supabase = createClient();
      const { error } = await supabase
        .from("profiles")
        .update(updates)
        .eq("id", userId as string);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["profile"] });
    },
  });
}

export function useCurrentUserEmail() {
  const userId = useAuthUserId();

  return useQuery({
    queryKey: ["current-user-email", userId],
    enabled: !!userId,
    queryFn: async () => {
      const supabase = createClient();
      const { data, error } = await supabase.auth.getUser();
      if (error) throw error;
      return data.user?.email ?? null;
    },
  });
}

// Usado en Settings > Seguridad — Supabase no expone listado de sesiones
// activas vía el SDK de cliente, así que por ahora solo mostramos el método
// de login actual (ver domain.md, "Seguridad avanzada" queda para después).
export function useAuthProvider() {
  const userId = useAuthUserId();

  return useQuery({
    queryKey: ["auth-provider", userId],
    enabled: !!userId,
    queryFn: async () => {
      const supabase = createClient();
      const { data, error } = await supabase.auth.getUser();
      if (error) throw error;
      return data.user?.app_metadata?.provider ?? "email";
    },
  });
}

export function useNotificationPreferences() {
  const userId = useAuthUserId();

  return useQuery({
    queryKey: ["notification-preferences", userId],
    enabled: !!userId,
    queryFn: async () => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("notification_preferences")
        .select("*")
        .eq("user_id", userId as string)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });
}

export function useUpdateNotificationPreferences() {
  const queryClient = useQueryClient();
  const userId = useAuthUserId();
  return useMutation({
    mutationFn: async (
      updates: Omit<TablesUpdate<"notification_preferences">, "user_id">,
    ) => {
      const supabase = createClient();
      const { error } = await supabase
        .from("notification_preferences")
        .upsert({ user_id: userId as string, ...updates });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notification-preferences"] });
    },
  });
}

// Elimina la cuenta del usuario (auth.users + cascada a profiles,
// household_members, etc). Requiere la service role key, así que pasa por
// una API route server-side (ver app/api/account/delete/route.ts) — el
// cliente nunca debe tener esa key.
// Nombre "UserAccount" (no "Account") a propósito: use-accounts.ts ya
// exporta useDeleteAccount para eliminar una cuenta bancaria/financiera —
// son conceptos distintos que no deben colisionar en un mismo import.
export function useDeleteUserAccount() {
  return useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/account/delete", { method: "POST" });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? "No se pudo eliminar la cuenta");
      }
    },
  });
}
