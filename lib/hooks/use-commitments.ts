"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { useAuthUserId } from "@/lib/hooks/use-auth-user-id";
import type { Tables, TablesInsert, TablesUpdate } from "@/types/supabase";

export type FinancialCommitment = Tables<"financial_commitments">;

// Compromisos financieros (cuotas, financiamientos, préstamos) — distintos
// de un gasto de categoría normal: son una obligación recurrente que se paga
// con transacciones type='financing_installment', sin duplicar la compra
// original como gasto nuevo. Ver domain.md "Compromisos financieros".
export function useCommitments() {
  const userId = useAuthUserId();

  return useQuery({
    queryKey: ["commitments", userId],
    enabled: !!userId,
    queryFn: async () => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("financial_commitments")
        .select("*")
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data;
    },
  });
}

export function useCreateCommitment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (commitment: TablesInsert<"financial_commitments">) => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("financial_commitments")
        .insert(commitment)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["commitments"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-summary"] });
    },
  });
}

export function useUpdateCommitment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      ...updates
    }: TablesUpdate<"financial_commitments"> & { id: string }) => {
      const supabase = createClient();
      const { error } = await supabase
        .from("financial_commitments")
        .update(updates)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["commitments"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-summary"] });
    },
  });
}

export function useDeleteCommitment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const supabase = createClient();
      const { error } = await supabase
        .from("financial_commitments")
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["commitments"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-summary"] });
    },
  });
}
