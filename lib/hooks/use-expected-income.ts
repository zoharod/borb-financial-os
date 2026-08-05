"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { useAuthUserId } from "@/lib/hooks/use-auth-user-id";
import type { Tables, TablesInsert, TablesUpdate } from "@/types/supabase";

export type ExpectedIncome = Tables<"expected_income">;

// Ingreso que todavía no llegó — no cuenta como recibido hasta convertirse en
// una transacción type='income' real. Se usa para proyectar flujo de caja,
// nunca para inflar el saldo actual. Ver domain.md "Ingreso esperado".
export function useExpectedIncome() {
  const userId = useAuthUserId();

  return useQuery({
    queryKey: ["expected-income", userId],
    enabled: !!userId,
    queryFn: async () => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("expected_income")
        .select("*")
        .order("expected_date", { ascending: true });
      if (error) throw error;
      return data;
    },
  });
}

export function useCreateExpectedIncome() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (income: TablesInsert<"expected_income">) => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("expected_income")
        .insert(income)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["expected-income"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-summary"] });
    },
  });
}

export function useUpdateExpectedIncome() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      ...updates
    }: TablesUpdate<"expected_income"> & { id: string }) => {
      const supabase = createClient();
      const { error } = await supabase
        .from("expected_income")
        .update(updates)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["expected-income"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-summary"] });
    },
  });
}

export function useDeleteExpectedIncome() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const supabase = createClient();
      const { error } = await supabase
        .from("expected_income")
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["expected-income"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-summary"] });
    },
  });
}
