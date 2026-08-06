"use client";

import { useQuery } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { useAuthUserId } from "@/lib/hooks/use-auth-user-id";
import { SETTLED_TRANSACTION_STATUSES } from "@/lib/constants";

export type AccountBalances = Record<string, number>;

// Saldo real por cuenta. A diferencia de use-dashboard-summary.ts (que
// agrega por moneda a nivel household y por eso puede ignorar
// transfer/card_payment, ya que se cancelan matemáticamente), acá SÍ
// importan: mueven plata de una cuenta puntual a otra. Ver architecture.md
// "Transferencias y tipos de transacción (Fase 1-C)".
export function useAccountBalances() {
  const userId = useAuthUserId();

  return useQuery({
    queryKey: ["account-balances", userId],
    enabled: !!userId,
    queryFn: async (): Promise<AccountBalances> => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("transactions")
        .select("account_id, to_account_id, type, amount")
        .in("status", SETTLED_TRANSACTION_STATUSES);

      if (error) throw error;

      const balances: AccountBalances = {};
      const add = (accountId: string, delta: number) => {
        balances[accountId] = (balances[accountId] ?? 0) + delta;
      };

      for (const row of data) {
        const amount = Number(row.amount);
        switch (row.type) {
          case "income":
          case "refund":
            add(row.account_id, amount);
            break;
          case "expense":
          case "financing_installment":
            add(row.account_id, -amount);
            break;
          case "adjustment":
            // amount puede ser negativo acá (corrección hacia abajo).
            add(row.account_id, amount);
            break;
          case "transfer":
          case "card_payment":
            add(row.account_id, -amount);
            if (row.to_account_id) add(row.to_account_id, amount);
            break;
        }
      }

      return balances;
    },
  });
}
