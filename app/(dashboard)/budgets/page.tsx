"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { Modal } from "@/components/ui/modal";
import { Input, Select, Label } from "@/components/ui/input";
import { useCurrentHousehold } from "@/lib/hooks/use-current-household";
import { useCategories, useUpdateCategory, type Category } from "@/lib/hooks/use-categories";
import {
  useBudgets,
  useCreateBudget,
  useDeleteBudget,
  useMonthlyActuals,
  type BudgetWithCategory,
} from "@/lib/hooks/use-budgets";
import { useDashboardSummary, currentMonthISO } from "@/lib/hooks/use-dashboard-summary";
import {
  useBudgetTemplates,
  useBudgetTemplateItems,
  useCreateBudgetTemplate,
  useArchiveBudgetTemplate,
  useAddBudgetTemplateItem,
  useDeleteBudgetTemplateItem,
  useDuplicateBudgetTemplate,
  useActivateBudgetTemplate,
} from "@/lib/hooks/use-budget-templates";
import { CURRENCIES, BUDGET_GROUPS } from "@/lib/constants";

function fmt(n: number) {
  return n.toLocaleString("es-HN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

const UNGROUPED = "__ungrouped__";

export default function BudgetsPage() {
  const { data: household } = useCurrentHousehold();
  const householdRow = household?.households as unknown as { base_currency_default: string } | null;
  const primaryCurrency = householdRow?.base_currency_default ?? "HNL";

  const [month, setMonth] = useState(currentMonthISO());
  const { data: categories } = useCategories();
  const { data: budgets, isLoading } = useBudgets(month);
  const { data: actuals } = useMonthlyActuals(month);
  const { data: summary } = useDashboardSummary(month, primaryCurrency);
  const createBudget = useCreateBudget();
  const deleteBudget = useDeleteBudget();
  const updateCategory = useUpdateCategory();

  const [templatesOpen, setTemplatesOpen] = useState(false);
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [addingCategoryId, setAddingCategoryId] = useState("");
  const [addingAmount, setAddingAmount] = useState("");
  const [addingCurrency, setAddingCurrency] = useState<(typeof CURRENCIES)[number]>("HNL");
  const [error, setError] = useState<string | null>(null);

  function toggleGroup(key: string) {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  async function handleAddBudget(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!household || !addingCategoryId) {
      setError("Elegí una categoría.");
      return;
    }
    try {
      await createBudget.mutateAsync({
        household_id: household.household_id,
        category_id: addingCategoryId,
        month,
        planned_amount: Number(addingAmount),
        currency: addingCurrency,
      });
      setAddingCategoryId("");
      setAddingAmount("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al guardar el presupuesto");
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("¿Eliminar este presupuesto?")) return;
    await deleteBudget.mutateAsync(id);
  }

  // Agrupa los presupuestos del mes por categories.group_name.
  const groupedBudgets = useMemo(() => {
    const byId = new Map((categories ?? []).map((c) => [c.id, c]));
    const groups = new Map<string, BudgetWithCategory[]>();
    for (const b of budgets ?? []) {
      const key = byId.get(b.category_id)?.group_name ?? UNGROUPED;
      groups.set(key, [...(groups.get(key) ?? []), b]);
    }
    // Orden fijo: los grupos conocidos en el orden de BUDGET_GROUPS, después
    // "Sin grupo" al final.
    const ordered: { key: string; label: string; items: BudgetWithCategory[] }[] = [];
    for (const g of BUDGET_GROUPS) {
      if (groups.has(g.value)) ordered.push({ key: g.value, label: g.label, items: groups.get(g.value)! });
    }
    if (groups.has(UNGROUPED)) ordered.push({ key: UNGROUPED, label: "Sin grupo", items: groups.get(UNGROUPED)! });
    return ordered;
  }, [budgets, categories]);

  const totalsByCurrency = useMemo(() => {
    const totals: Record<string, { planned: number; actual: number }> = {};
    for (const b of budgets ?? []) {
      const actual = actuals?.[`${b.category_id}:${b.currency}`] ?? 0;
      totals[b.currency] ??= { planned: 0, actual: 0 };
      totals[b.currency].planned += Number(b.planned_amount);
      totals[b.currency].actual += actual;
    }
    return totals;
  }, [budgets, actuals]);

  const largestCategories = useMemo(
    () => [...(budgets ?? [])].sort((a, b) => Number(b.planned_amount) - Number(a.planned_amount)).slice(0, 3),
    [budgets],
  );

  const overBudget = useMemo(
    () =>
      (budgets ?? []).filter(
        (b) => (actuals?.[`${b.category_id}:${b.currency}`] ?? 0) > Number(b.planned_amount),
      ),
    [budgets, actuals],
  );

  return (
    <div className="max-w-3xl">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-on-surface tracking-tight flex items-center gap-2">
          <Icon name="savings" className="text-primary" filled />
          Presupuesto
        </h1>
        <div className="flex items-center gap-3">
          <Link href="/categories" className="text-xs text-on-surface-variant hover:text-on-surface underline">
            Gestionar categorías
          </Link>
          <Button variant="secondary" onClick={() => setTemplatesOpen(true)}>
            Plantillas
          </Button>
        </div>
      </div>

      <div className="mb-6">
        <Label>Mes</Label>
        <input
          type="month"
          value={month.slice(0, 7)}
          onChange={(e) => setMonth(`${e.target.value}-01`)}
          className="rounded-full bg-surface-container-high border border-outline-variant/50 px-4 py-2 text-on-surface outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all"
        />
      </div>

      {/* Resumen del presupuesto (item 6 del feedback) */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-6">
        {Object.entries(totalsByCurrency).map(([currency, t]) => {
          const expected = summary?.expectedIncomeThisMonth?.[currency] ?? 0;
          const committed = summary?.committedThisMonth?.[currency] ?? 0;
          const remaining = t.planned - t.actual;
          const projectedSavings = expected - t.planned - committed;
          const savingsRate = expected > 0 ? (projectedSavings / expected) * 100 : null;
          const completion = t.planned > 0 ? (t.actual / t.planned) * 100 : 0;
          return (
            <div key={currency} className="col-span-2 md:col-span-3 grid grid-cols-2 md:grid-cols-4 gap-3">
              <Card>
                <p className="text-xs text-on-surface-variant">Presupuesto mensual ({currency})</p>
                <p className="text-xl font-bold text-on-surface font-mono">{fmt(t.planned)}</p>
              </Card>
              <Card>
                <p className="text-xs text-on-surface-variant">Ingreso esperado</p>
                <p className="text-xl font-bold text-on-surface font-mono">{fmt(expected)}</p>
              </Card>
              <Card>
                <p className="text-xs text-on-surface-variant">Comprometido</p>
                <p className="text-xl font-bold text-on-surface font-mono">{fmt(committed)}</p>
              </Card>
              <Card>
                <p className="text-xs text-on-surface-variant">Disponible restante</p>
                <p className={`text-xl font-bold font-mono ${remaining < 0 ? "text-error" : "text-on-surface"}`}>
                  {fmt(remaining)}
                </p>
              </Card>
              <Card>
                <p className="text-xs text-on-surface-variant">Ahorro proyectado</p>
                <p className={`text-xl font-bold font-mono ${projectedSavings < 0 ? "text-error" : "text-secondary"}`}>
                  {fmt(projectedSavings)}
                </p>
              </Card>
              <Card>
                <p className="text-xs text-on-surface-variant">Tasa de ahorro</p>
                <p className="text-xl font-bold text-on-surface font-mono">
                  {savingsRate === null ? "—" : `${savingsRate.toFixed(0)}%`}
                </p>
              </Card>
              <Card>
                <p className="text-xs text-on-surface-variant">Presupuesto usado</p>
                <p className="text-xl font-bold text-on-surface font-mono">{completion.toFixed(0)}%</p>
              </Card>
              <Card>
                <p className="text-xs text-on-surface-variant">Categorías excedidas</p>
                <p className={`text-xl font-bold font-mono ${overBudget.length > 0 ? "text-error" : "text-on-surface"}`}>
                  {overBudget.length}
                </p>
              </Card>
            </div>
          );
        })}
        {largestCategories.length > 0 && (
          <Card className="col-span-2 md:col-span-3">
            <p className="text-xs text-on-surface-variant mb-2">Categorías más grandes</p>
            <div className="flex flex-wrap gap-4">
              {largestCategories.map((b) => (
                <p key={b.id} className="text-sm text-on-surface">
                  {b.categories?.name}: <span className="font-mono">{fmt(Number(b.planned_amount))} {b.currency}</span>
                </p>
              ))}
            </div>
          </Card>
        )}
      </div>

      <Card className="mb-6">
        <form onSubmit={handleAddBudget} className="flex flex-col gap-4">
          <div>
            <Label>Categoría</Label>
            <Select required value={addingCategoryId} onChange={(e) => setAddingCategoryId(e.target.value)}>
              <option value="">Elegir...</option>
              {categories?.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </Select>
          </div>
          <div className="flex gap-4">
            <div className="flex-1">
              <Label>Monto planeado</Label>
              <Input type="number" step="0.01" min="0" required value={addingAmount} onChange={(e) => setAddingAmount(e.target.value)} />
            </div>
            <div className="flex-1">
              <Label>Moneda</Label>
              <Select value={addingCurrency} onChange={(e) => setAddingCurrency(e.target.value as (typeof CURRENCIES)[number])}>
                {CURRENCIES.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </Select>
            </div>
          </div>
          {error && <p className="text-sm text-error" role="alert">{error}</p>}
          <Button type="submit" disabled={createBudget.isPending}>
            {createBudget.isPending ? "Guardando..." : "Agregar / actualizar presupuesto"}
          </Button>
        </form>
      </Card>

      {isLoading ? (
        <p className="text-on-surface-variant text-sm">Cargando...</p>
      ) : groupedBudgets.length === 0 ? (
        <p className="text-on-surface-variant text-sm">No hay presupuesto definido para este mes.</p>
      ) : (
        <div className="flex flex-col gap-4">
          {groupedBudgets.map((group) => {
            const groupPlanned = group.items.reduce((sum, b) => sum + Number(b.planned_amount), 0);
            const groupActual = group.items.reduce(
              (sum, b) => sum + (actuals?.[`${b.category_id}:${b.currency}`] ?? 0),
              0,
            );
            const isCollapsed = collapsed.has(group.key);
            return (
              <Card key={group.key}>
                <button
                  type="button"
                  onClick={() => toggleGroup(group.key)}
                  className="w-full flex items-center justify-between text-left"
                >
                  <div className="flex items-center gap-2">
                    <Icon name={isCollapsed ? "chevron_right" : "expand_more"} className="text-on-surface-variant" />
                    <p className="font-medium text-on-surface">{group.label}</p>
                  </div>
                  <p className="font-mono text-sm text-on-surface-variant">
                    {fmt(groupActual)} / {fmt(groupPlanned)} · restante {fmt(groupPlanned - groupActual)}
                  </p>
                </button>

                {!isCollapsed && (
                  <ul className="mt-3 pt-3 border-t border-outline-variant/20 space-y-2">
                    {group.items.map((budget) => {
                      const actual = actuals?.[`${budget.category_id}:${budget.currency}`] ?? 0;
                      const pct = Math.min(100, (actual / Number(budget.planned_amount)) * 100);
                      const exceeded = actual > Number(budget.planned_amount);
                      return (
                        <li key={budget.id}>
                          <div className="flex items-center justify-between mb-1">
                            <p className="text-sm text-on-surface">{budget.categories?.name}</p>
                            <div className="flex items-center gap-3">
                              <span className="font-mono text-xs text-on-surface-variant">
                                {actual.toFixed(2)} / {Number(budget.planned_amount).toFixed(2)} {budget.currency}
                              </span>
                              <Select
                                value={
                                  (categories ?? []).find((c) => c.id === budget.category_id)?.group_name ?? ""
                                }
                                onChange={(e) =>
                                  updateCategory.mutate({
                                    id: budget.category_id,
                                    group_name: e.target.value || null,
                                  })
                                }
                                className="!w-auto !py-1 !text-xs"
                              >
                                <option value="">Sin grupo</option>
                                {BUDGET_GROUPS.map((g) => (
                                  <option key={g.value} value={g.value}>{g.label}</option>
                                ))}
                              </Select>
                              <Button variant="danger" onClick={() => handleDelete(budget.id)}>
                                Eliminar
                              </Button>
                            </div>
                          </div>
                          <div className="h-1.5 rounded-full bg-surface-container-lowest overflow-hidden">
                            <div
                              className={`h-full rounded-full ${exceeded ? "bg-error" : "bg-secondary"}`}
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </Card>
            );
          })}
        </div>
      )}

      {templatesOpen && household && (
        <Modal title="Plantillas de presupuesto" onClose={() => setTemplatesOpen(false)}>
          <BudgetTemplatesPanel householdId={household.household_id} month={month} categories={categories ?? []} />
        </Modal>
      )}
    </div>
  );
}

function BudgetTemplatesPanel({
  householdId,
  month,
  categories,
}: {
  householdId: string;
  month: string;
  categories: Category[];
}) {
  const { data: templates } = useBudgetTemplates();
  const createTemplate = useCreateBudgetTemplate();
  const archiveTemplate = useArchiveBudgetTemplate();
  const duplicateTemplate = useDuplicateBudgetTemplate();
  const activateTemplate = useActivateBudgetTemplate();

  const [newName, setNewName] = useState("");
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null);
  const [showArchived, setShowArchived] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const { data: items } = useBudgetTemplateItems(selectedTemplateId);
  const addItem = useAddBudgetTemplateItem();
  const deleteItem = useDeleteBudgetTemplateItem();

  const [itemCategoryId, setItemCategoryId] = useState("");
  const [itemAmount, setItemAmount] = useState("");
  const [itemCurrency, setItemCurrency] = useState<(typeof CURRENCIES)[number]>("HNL");

  const visibleTemplates = (templates ?? []).filter((t) => t.is_archived === showArchived);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!newName.trim()) return;
    const created = await createTemplate.mutateAsync({ household_id: householdId, name: newName.trim() });
    setNewName("");
    setSelectedTemplateId(created.id);
  }

  async function handleAddItem(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedTemplateId || !itemCategoryId) return;
    const category = categories.find((c) => c.id === itemCategoryId);
    await addItem.mutateAsync({
      template_id: selectedTemplateId,
      category_id: itemCategoryId,
      category_name: category?.name ?? null,
      planned_amount: Number(itemAmount),
      currency: itemCurrency,
    });
    setItemCategoryId("");
    setItemAmount("");
  }

  async function handleActivate(templateId: string) {
    await activateTemplate.mutateAsync({ householdId, templateId, month });
    setMessage(`Plantilla activada para ${month.slice(0, 7)}.`);
  }

  return (
    <div className="flex flex-col gap-4">
      <form onSubmit={handleCreate} className="flex gap-2">
        <Input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Nombre de la plantilla (ej. Conservador, Vacaciones)" />
        <Button type="submit" disabled={createTemplate.isPending}>Crear</Button>
      </form>

      <div className="flex items-center gap-2 text-xs">
        <button type="button" className={!showArchived ? "text-primary" : "text-on-surface-variant"} onClick={() => setShowArchived(false)}>
          Activas
        </button>
        <span className="text-on-surface-variant">·</span>
        <button type="button" className={showArchived ? "text-primary" : "text-on-surface-variant"} onClick={() => setShowArchived(true)}>
          Archivadas
        </button>
      </div>

      {message && <p className="text-sm text-secondary">{message}</p>}

      <ul className="space-y-2">
        {visibleTemplates.map((t) => (
          <li key={t.id}>
            <Card className="py-3">
              <div className="flex items-center justify-between">
                <button
                  type="button"
                  className="text-on-surface font-medium text-left"
                  onClick={() => setSelectedTemplateId(t.id === selectedTemplateId ? null : t.id)}
                >
                  {t.name}
                </button>
                <div className="flex items-center gap-2">
                  {!t.is_archived && (
                    <Button variant="secondary" onClick={() => handleActivate(t.id)} disabled={activateTemplate.isPending}>
                      Activar para el mes
                    </Button>
                  )}
                  <Button
                    variant="tertiary"
                    onClick={() =>
                      duplicateTemplate.mutate({
                        householdId,
                        sourceTemplateId: t.id,
                        newName: `${t.name} (copia)`,
                      })
                    }
                  >
                    Duplicar
                  </Button>
                  <Button
                    variant="tertiary"
                    onClick={() => archiveTemplate.mutate({ id: t.id, archived: !t.is_archived })}
                  >
                    {t.is_archived ? "Reactivar" : "Archivar"}
                  </Button>
                </div>
              </div>

              {selectedTemplateId === t.id && (
                <div className="mt-3 pt-3 border-t border-outline-variant/20 flex flex-col gap-2">
                  {items?.map((item) => (
                    <div key={item.id} className="flex items-center justify-between text-sm">
                      <p className="text-on-surface">{item.categories?.name ?? item.category_name}</p>
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-on-surface-variant">
                          {Number(item.planned_amount).toFixed(2)} {item.currency}
                        </span>
                        <Button
                          variant="danger"
                          onClick={() => deleteItem.mutate({ id: item.id, templateId: t.id })}
                        >
                          Quitar
                        </Button>
                      </div>
                    </div>
                  ))}
                  <form onSubmit={handleAddItem} className="flex gap-2 items-end mt-2">
                    <Select value={itemCategoryId} onChange={(e) => setItemCategoryId(e.target.value)}>
                      <option value="">Categoría...</option>
                      {categories.map((c) => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                      ))}
                    </Select>
                    <Input type="number" step="0.01" placeholder="Monto" value={itemAmount} onChange={(e) => setItemAmount(e.target.value)} className="w-28" />
                    <Select value={itemCurrency} onChange={(e) => setItemCurrency(e.target.value as (typeof CURRENCIES)[number])} className="w-24">
                      {CURRENCIES.map((c) => (
                        <option key={c} value={c}>{c}</option>
                      ))}
                    </Select>
                    <Button type="submit" variant="secondary" disabled={addItem.isPending}>Agregar línea</Button>
                  </form>
                </div>
              )}
            </Card>
          </li>
        ))}
        {visibleTemplates.length === 0 && (
          <p className="text-on-surface-variant text-sm">
            {showArchived ? "No hay plantillas archivadas." : "No hay plantillas todavía."}
          </p>
        )}
      </ul>
    </div>
  );
}
