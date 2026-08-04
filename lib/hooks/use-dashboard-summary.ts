"use client";

import { useQuery } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { useAuthUserId } from "@/lib/hooks/use-auth-user-id";

export function currentMonthISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
}

function monthEndOf(month: string) {
  const [year, monthNum] = month.split("-").map(Number);
  const daysInMonth = new Date(year, monthNum, 0).getDate();
  return `${year}-${String(monthNum).padStart(2, "0")}-${String(daysInMonth).padStart(2, "0")}`;
}

export type CurrencyTotals = Record<string, number>;

export type DashboardSummary = {
  monthlyIncome: CurrencyTotals;
  monthlyExpense: CurrencyTotals;
  balance: CurrencyTotals;
};

// Ver architecture.md "Transferencias y tipos de transacción (Fase 1-C)"
// para la tabla completa de qué tipo afecta qué.
export function useDashboardSummary(month: string) {
  const userId = useAuthUserId();

  return useQuery({
    // Ver use-current-household.ts: key con userId para no mezclar cache
    // entre usuarios distintos en el mismo navegador.
    queryKey: ["dashboard-summary", month, userId],
    enabled: !!userId,
    queryFn: async (): Promise<DashboardSummary> => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("transactions")
        .select("type, amount, currency, transaction_date");

      if (error) throw error;

      const monthStart = month;
      const monthEnd = monthEndOf(month);

      const monthlyIncome: CurrencyTotals = {};
      const monthlyExpense: CurrencyTotals = {};
      const balance: CurrencyTotals = {};

      for (const row of data) {
        const amount = Number(row.amount);
        const inMonth =
          row.transaction_date >= monthStart && row.transaction_date <= monthEnd;

        switch (row.type) {
          case "income":
            balance[row.currency] = (balance[row.currency] ?? 0) + amount;
            if (inMonth) {
              monthlyIncome[row.currency] =
                (monthlyIncome[row.currency] ?? 0) + amount;
            }
            break;
          case "expense":
            balance[row.currency] = (balance[row.currency] ?? 0) - amount;
            if (inMonth) {
              monthlyExpense[row.currency] =
                (monthlyExpense[row.currency] ?? 0) + amount;
            }
            break;
          case "refund":
            // Resta del gasto neto (no cuenta como ingreso nuevo), pero sí
            // aumenta el saldo — la plata vuelve de verdad.
            balance[row.currency] = (balance[row.currency] ?? 0) + amount;
            if (inMonth) {
              monthlyExpense[row.currency] =
                (monthlyExpense[row.currency] ?? 0) - amount;
            }
            break;
          case "adjustment":
            // amount puede ser negativo acá (única excepción, ver
            // architecture.md); no cuenta como ingreso ni gasto.
            balance[row.currency] = (balance[row.currency] ?? 0) + amount;
            break;
          case "transfer":
          case "card_payment":
            // Se ignoran a propósito: mueven plata entre 2 cuentas de la
            // misma moneda (forzado por el trigger de la base), así que su
            // efecto neto sobre el saldo total en esa moneda es cero — no
            // hace falta sumar/restar nada de ningún lado.
            break;
        }
      }

      return { monthlyIncome, monthlyExpense, balance };
    },
  });
}
