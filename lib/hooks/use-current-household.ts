"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { useAuthUserId } from "@/lib/hooks/use-auth-user-id";

export type OnboardingStep =
  | "household"
  | "accounts"
  | "cards"
  | "budget"
  | "commitments"
  | "income"
  | "review"
  | "done";

export function useCurrentHousehold() {
  const userId = useAuthUserId();

  return useQuery({
    // La queryKey incluye userId: sin esto, si dos usuarios de households
    // distintos usan el mismo navegador (o el mismo perfil de dev), la
    // cache persistida en IndexedDB de un usuario queda pegada y se le
    // sirve al otro (bug real encontrado en Fase 1, ver project_state.md).
    queryKey: ["current-household", userId],
    enabled: !!userId,
    queryFn: async () => {
      const supabase = createClient();
      // maybeSingle (no single): un usuario recién logueado sin household
      // todavía es un estado válido (null), no un error.
      const { data, error } = await supabase
        .from("household_members")
        .select(
          "household_id, role, households(name, avatar_url, base_currency_default, secondary_currency, onboarding_step, financial_month_start_day, default_budget_period)",
        )
        .limit(1)
        .maybeSingle();

      if (error) throw error;
      return data;
    },
  });
}

export function useCreateHousehold() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (params: {
      name: string;
      primaryCurrency: string;
      secondaryCurrency: string | null;
    }) => {
      const supabase = createClient();
      const { data, error } = await supabase.rpc(
        "create_household_for_current_user",
        {
          household_name: params.name,
          primary_currency: params.primaryCurrency,
          household_secondary_currency: params.secondaryCurrency ?? undefined,
        },
      );
      if (error) throw error;
      return data as string;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["current-household"] });
    },
  });
}

// Configuración del hogar (nombre/avatar/monedas/mes financiero/período de
// presupuesto) — distinto de useUpdateOnboardingStep: esto es lo que se usa
// desde /household, requiere rol owner/admin (RLS lo exige, no solo la UI).
export function useUpdateHouseholdSettings() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      householdId,
      ...updates
    }: {
      householdId: string;
      name?: string;
      avatar_url?: string | null;
      base_currency_default?: string;
      secondary_currency?: string | null;
      financial_month_start_day?: number;
      default_budget_period?: string;
    }) => {
      const supabase = createClient();
      const { error } = await supabase
        .from("households")
        .update(updates)
        .eq("id", householdId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["current-household"] });
    },
  });
}

export function useUpdateOnboardingStep() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      householdId,
      step,
    }: {
      householdId: string;
      step: OnboardingStep;
    }) => {
      const supabase = createClient();
      const { error } = await supabase
        .from("households")
        .update({ onboarding_step: step })
        .eq("id", householdId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["current-household"] });
    },
  });
}
