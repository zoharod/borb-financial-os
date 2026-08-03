"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { useAuthUserId } from "@/lib/hooks/use-auth-user-id";
import type { TablesInsert } from "@/types/supabase";

// Claves "fecha:monto:moneda" de las transacciones ya existentes de una
// cuenta, para detección de duplicados básica al importar CSV. Se devuelve
// un array (no un Set — ver regla de datos JSON-safe en architecture.md);
// el componente arma el Set en memoria a partir de este array.
export function useExistingTransactionKeys(accountId: string | null) {
  const userId = useAuthUserId();

  return useQuery({
    queryKey: ["existing-transaction-keys", accountId, userId],
    enabled: !!userId && !!accountId,
    queryFn: async () => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("transactions")
        .select("transaction_date, amount, currency")
        .eq("account_id", accountId as string);

      if (error) throw error;
      // toFixed(2) para no fallar la comparación por precisión flotante /
      // formato ("450" vs "450.00") entre lo guardado y lo parseado del CSV.
      return data.map(
        (row) =>
          `${row.transaction_date}:${Number(row.amount).toFixed(2)}:${row.currency}`,
      );
    },
  });
}

export function useBulkCreateTransactions() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (
      transactions: Omit<TablesInsert<"transactions">, "created_by">[],
    ) => {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("No hay sesión activa.");

      const { error } = await supabase
        .from("transactions")
        .insert(transactions.map((t) => ({ ...t, created_by: user.id })));
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["transactions"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-summary"] });
      queryClient.invalidateQueries({ queryKey: ["monthly-actuals"] });
      queryClient.invalidateQueries({ queryKey: ["existing-transaction-keys"] });
    },
  });
}
