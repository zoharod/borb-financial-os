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
  status: string;
  description: string | null;
  transaction_date: string;
  account_id: string;
  to_account_id: string | null;
  category_id: string | null;
  created_by: string;
  accounts: { name: string } | null;
  to_account: { name: string } | null;
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
          "id, type, amount, currency, status, description, transaction_date, account_id, to_account_id, category_id, created_by, accounts!transactions_account_id_fkey(name), to_account:accounts!transactions_to_account_id_fkey(name), categories(name)",
        )
        .order("transaction_date", { ascending: false })
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data as unknown as TransactionWithRelations[];
    },
  });
}

// Toda mutación de transacciones invalida las 4 queries derivadas — no solo
// "transactions". Antes solo invalidaba esa y las demás (dashboard-summary,
// monthly-actuals, account-balances) quedaban con datos viejos hasta que
// staleTime (60s) expirara solo; en la práctica parecían "andar bien" por
// casualidad de timing entre pasos manuales, no porque estuviera bien armado
// — se detectó al probar conciliación en el mismo `/accounts` sin navegar
// (sin remount no hay refetch automático, así que el saldo quedaba viejo).
function invalidateTransactionDerivedQueries(queryClient: ReturnType<typeof useQueryClient>) {
  queryClient.invalidateQueries({ queryKey: ["transactions"] });
  queryClient.invalidateQueries({ queryKey: ["dashboard-summary"] });
  queryClient.invalidateQueries({ queryKey: ["monthly-actuals"] });
  queryClient.invalidateQueries({ queryKey: ["account-balances"] });
}

export function useCreateTransaction() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (
      // created_by es opcional: por default es quien está logueado, pero el
      // formulario permite registrar un gasto "a nombre de" otro miembro del
      // hogar (ej. cargar un gasto que hizo tu pareja) — ver TransactionForm.
      transaction: Omit<TablesInsert<"transactions">, "created_by"> & {
        created_by?: string;
      },
    ) => {
      const supabase = createClient();
      let createdBy = transaction.created_by;
      if (!createdBy) {
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (!user) throw new Error("No hay sesión activa.");
        createdBy = user.id;
      }

      const { error } = await supabase
        .from("transactions")
        .insert({ ...transaction, created_by: createdBy });
      if (error) throw error;
    },
    onSuccess: () => invalidateTransactionDerivedQueries(queryClient),
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
    onSuccess: () => invalidateTransactionDerivedQueries(queryClient),
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
    onSuccess: () => invalidateTransactionDerivedQueries(queryClient),
  });
}
