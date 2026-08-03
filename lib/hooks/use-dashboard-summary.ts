"use client";

import { useQuery } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";

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

export function useDashboardSummary(month: string) {
  return useQuery({
    queryKey: ["dashboard-summary", month],
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

        if (row.type === "income") {
          balance[row.currency] = (balance[row.currency] ?? 0) + amount;
          if (inMonth) {
            monthlyIncome[row.currency] =
              (monthlyIncome[row.currency] ?? 0) + amount;
          }
        } else if (row.type === "expense") {
          balance[row.currency] = (balance[row.currency] ?? 0) - amount;
          if (inMonth) {
            monthlyExpense[row.currency] =
              (monthlyExpense[row.currency] ?? 0) + amount;
          }
        } else if (row.type === "transfer") {
          // Simplificación Fase 1: el schema solo guarda un account_id por
          // transacción (ver architecture.md), sin cuenta destino, así que no
          // hay forma de saber si esta fila es el lado "entrada" o "salida"
          // de la transferencia. Se trata como salida de la cuenta de origen.
          // Revisar si Fase 2+ agrega conciliación entre cuentas.
          balance[row.currency] = (balance[row.currency] ?? 0) - amount;
        }
      }

      return { monthlyIncome, monthlyExpense, balance };
    },
  });
}
