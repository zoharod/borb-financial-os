"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import type { TablesInsert } from "@/types/supabase";

export type BudgetWithCategory = {
  id: string;
  category_id: string;
  month: string;
  planned_amount: number;
  currency: string;
  categories: { name: string } | null;
};

export function useBudgets(month: string) {
  return useQuery({
    queryKey: ["budgets", month],
    queryFn: async () => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("budgets")
        .select("id, category_id, month, planned_amount, currency, categories(name)")
        .eq("month", month);

      if (error) throw error;
      return data as unknown as BudgetWithCategory[];
    },
  });
}

// Gasto real del mes por categoría+moneda, para comparar contra el presupuesto.
// Devuelve un objeto plano (no Map): la cache de TanStack Query se persiste a
// IndexedDB vía JSON (ver lib/providers/query-provider.tsx), y un Map no
// sobrevive ese round-trip — al hidratar queda como objeto sin métodos y
// revienta el componente. Cualquier dato cacheado acá debe ser JSON-safe.
export function useMonthlyActuals(month: string) {
  return useQuery({
    queryKey: ["monthly-actuals", month],
    queryFn: async () => {
      const supabase = createClient();
      const monthStart = month;
      const [year, monthNum] = month.split("-").map(Number);
      // Date(year, monthIndex, day) toma números, no un string ISO, así que
      // se construye en hora local directamente (sin el bug de parsear
      // "YYYY-MM-01" como medianoche UTC, que en timezones detrás de UTC
      // corre el mes hacia atrás e invierte el rango monthStart/monthEnd).
      const daysInMonth = new Date(year, monthNum, 0).getDate();
      const monthEnd = `${year}-${String(monthNum).padStart(2, "0")}-${String(daysInMonth).padStart(2, "0")}`;

      const { data, error } = await supabase
        .from("transactions")
        .select("category_id, currency, amount")
        .eq("type", "expense")
        .gte("transaction_date", monthStart)
        .lte("transaction_date", monthEnd);

      if (error) throw error;

      const totals: Record<string, number> = {};
      for (const row of data) {
        if (!row.category_id) continue;
        const key = `${row.category_id}:${row.currency}`;
        totals[key] = (totals[key] ?? 0) + Number(row.amount);
      }
      return totals;
    },
  });
}

export function useCreateBudget() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (budget: TablesInsert<"budgets">) => {
      const supabase = createClient();
      const { error } = await supabase.from("budgets").insert(budget);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["budgets"] });
    },
  });
}

export function useDeleteBudget() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const supabase = createClient();
      const { error } = await supabase.from("budgets").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["budgets"] });
    },
  });
}
