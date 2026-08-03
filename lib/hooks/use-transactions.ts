"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { useAuthUserId } from "@/lib/hooks/use-auth-user-id";
import type { TablesInsert, TablesUpdate } from "@/types/supabase";

export type TransactionWithRelations = {
  id: string;
  type: string;
  amount: number;
  currency: string;
  description: string | null;
  transaction_date: string;
  account_id: string;
  category_id: string | null;
  accounts: { name: string } | null;
  categories: { name: string } | null;
};

export function useTransactions() {
  const userId = useAuthUserId();

  return useQuery({
    // Ver use-current-household.ts: key con userId para no mezclar cache
    // entre usuarios distintos en el mismo navegador.
    queryKey: ["transactions", userId],
    enabled: !!userId,
    queryFn: async () => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("transactions")
        .select(
          "id, type, amount, currency, description, transaction_date, account_id, category_id, accounts(name), categories(name)",
        )
        .order("transaction_date", { ascending: false })
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data as unknown as TransactionWithRelations[];
    },
  });
}

export function useCreateTransaction() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (
      transaction: Omit<TablesInsert<"transactions">, "created_by">,
    ) => {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("No hay sesión activa.");

      const { error } = await supabase
        .from("transactions")
        .insert({ ...transaction, created_by: user.id });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["transactions"] });
    },
  });
}

export function useUpdateTransaction() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      ...updates
    }: TablesUpdate<"transactions"> & { id: string }) => {
      const supabase = createClient();
      const { error } = await supabase
        .from("transactions")
        .update(updates)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["transactions"] });
    },
  });
}

export function useDeleteTransaction() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const supabase = createClient();
      const { error } = await supabase
        .from("transactions")
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["transactions"] });
    },
  });
}
