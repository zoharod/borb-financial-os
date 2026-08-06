"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { useAuthUserId } from "@/lib/hooks/use-auth-user-id";
import type { Tables, TablesInsert } from "@/types/supabase";

export type BudgetTemplate = Tables<"budget_templates">;
export type BudgetTemplateItem = Tables<"budget_template_items"> & {
  categories: { name: string } | null;
};

export function useBudgetTemplates() {
  const userId = useAuthUserId();

  return useQuery({
    queryKey: ["budget-templates", userId],
    enabled: !!userId,
    queryFn: async () => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("budget_templates")
        .select("*")
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data;
    },
  });
}

export function useBudgetTemplateItems(templateId: string | null) {
  const userId = useAuthUserId();

  return useQuery({
    queryKey: ["budget-template-items", templateId, userId],
    enabled: !!userId && !!templateId,
    queryFn: async () => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("budget_template_items")
        .select("*, categories(name)")
        .eq("template_id", templateId as string)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data as unknown as BudgetTemplateItem[];
    },
  });
}

export function useCreateBudgetTemplate() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (template: TablesInsert<"budget_templates">) => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("budget_templates")
        .insert(template)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["budget-templates"] });
    },
  });
}

export function useArchiveBudgetTemplate() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, archived }: { id: string; archived: boolean }) => {
      const supabase = createClient();
      const { error } = await supabase
        .from("budget_templates")
        .update({ is_archived: archived })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["budget-templates"] });
    },
  });
}

export function useAddBudgetTemplateItem() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (item: TablesInsert<"budget_template_items">) => {
      const supabase = createClient();
      const { error } = await supabase.from("budget_template_items").insert(item);
      if (error) throw error;
    },
    onSuccess: (_, item) => {
      queryClient.invalidateQueries({
        queryKey: ["budget-template-items", item.template_id],
      });
    },
  });
}

export function useDeleteBudgetTemplateItem() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id }: { id: string; templateId: string }) => {
      const supabase = createClient();
      const { error } = await supabase
        .from("budget_template_items")
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: (_, { templateId }) => {
      queryClient.invalidateQueries({
        queryKey: ["budget-template-items", templateId],
      });
    },
  });
}

// Duplica una plantilla (nombre + todas sus líneas) como una plantilla nueva
// independiente — editar la copia nunca toca el original.
export function useDuplicateBudgetTemplate() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      householdId,
      sourceTemplateId,
      newName,
    }: {
      householdId: string;
      sourceTemplateId: string;
      newName: string;
    }) => {
      const supabase = createClient();
      const { data: newTemplate, error: templateError } = await supabase
        .from("budget_templates")
        .insert({ household_id: householdId, name: newName })
        .select()
        .single();
      if (templateError) throw templateError;

      const { data: items, error: itemsError } = await supabase
        .from("budget_template_items")
        .select("category_id, category_name, planned_amount, currency")
        .eq("template_id", sourceTemplateId);
      if (itemsError) throw itemsError;

      if (items.length > 0) {
        const { error: insertError } = await supabase
          .from("budget_template_items")
          .insert(items.map((i) => ({ ...i, template_id: newTemplate.id })));
        if (insertError) throw insertError;
      }

      return newTemplate;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["budget-templates"] });
    },
  });
}

// "Activar para el mes": copia cada línea de la plantilla como un
// budgets.upsert para ese mes (mismo mecanismo que useCreateBudget — pisa el
// monto si ya existía un presupuesto para esa categoría+mes, no falla).
// Las líneas con category_name pero sin category_id (categoría personalizada
// que todavía no existe) crean la categoría primero.
export function useActivateBudgetTemplate() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      householdId,
      templateId,
      month,
    }: {
      householdId: string;
      templateId: string;
      month: string;
    }) => {
      const supabase = createClient();
      const { data: items, error: itemsError } = await supabase
        .from("budget_template_items")
        .select("category_id, category_name, planned_amount, currency")
        .eq("template_id", templateId);
      if (itemsError) throw itemsError;

      for (const item of items) {
        let categoryId = item.category_id;
        if (!categoryId && item.category_name) {
          const { data: newCategory, error: categoryError } = await supabase
            .from("categories")
            .insert({ household_id: householdId, name: item.category_name })
            .select()
            .single();
          if (categoryError) throw categoryError;
          categoryId = newCategory.id;
        }
        if (!categoryId) continue;

        const { error: budgetError } = await supabase.from("budgets").upsert(
          {
            household_id: householdId,
            category_id: categoryId,
            month,
            planned_amount: item.planned_amount,
            currency: item.currency,
          },
          { onConflict: "household_id,category_id,month" },
        );
        if (budgetError) throw budgetError;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["budgets"] });
      queryClient.invalidateQueries({ queryKey: ["categories"] });
    },
  });
}
