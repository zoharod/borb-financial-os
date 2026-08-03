"use client";

import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { useCurrentHousehold } from "@/lib/hooks/use-current-household";
import {
  useCategories,
  useCreateCategory,
  useDeleteCategory,
  type Category,
} from "@/lib/hooks/use-categories";

export default function CategoriesPage() {
  const { data: household } = useCurrentHousehold();
  const { data: categories, isLoading } = useCategories();
  const createCategory = useCreateCategory();
  const deleteCategory = useDeleteCategory();

  const [name, setName] = useState("");
  const [isExtraDefault, setIsExtraDefault] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!household) {
      setError("No se encontró tu household todavía.");
      return;
    }

    try {
      await createCategory.mutateAsync({
        household_id: household.household_id,
        name,
        is_extra_default: isExtraDefault,
      });
      setName("");
      setIsExtraDefault(false);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Error al crear la categoría",
      );
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("¿Eliminar esta categoría?")) return;
    await deleteCategory.mutateAsync(id);
  }

  return (
    <div className="max-w-2xl">
      <h1 className="text-xl font-semibold text-on-surface mb-6">
        Categorías
      </h1>

      <Card className="mb-6">
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div>
            <Label>Nombre</Label>
            <Input
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Comida, Transporte, ..."
            />
          </div>

          <label className="flex items-center gap-2 text-sm text-on-surface-variant">
            <input
              type="checkbox"
              checked={isExtraDefault}
              onChange={(e) => setIsExtraDefault(e.target.checked)}
            />
            Usar como categoría por defecto para gastos sin presupuesto
            (&quot;Extras/Imprevistos&quot;)
          </label>

          {error && (
            <p className="text-sm text-error" role="alert">
              {error}
            </p>
          )}

          <Button type="submit" disabled={createCategory.isPending}>
            {createCategory.isPending ? "Creando..." : "Agregar categoría"}
          </Button>
        </form>
      </Card>

      {isLoading ? (
        <p className="text-on-surface-variant text-sm">Cargando...</p>
      ) : categories && categories.length > 0 ? (
        <ul className="space-y-3">
          {categories.map((category: Category) => (
            <li key={category.id}>
              <Card className="flex items-center justify-between py-4">
                <div>
                  <p className="text-on-surface font-medium">
                    {category.name}
                  </p>
                  {category.is_extra_default && (
                    <p className="text-on-surface-variant text-xs font-mono uppercase tracking-wider">
                      Extras/Imprevistos
                    </p>
                  )}
                </div>
                <Button
                  variant="danger"
                  onClick={() => handleDelete(category.id)}
                >
                  Eliminar
                </Button>
              </Card>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-on-surface-variant text-sm">
          No hay categorías todavía. Agregá la primera arriba.
        </p>
      )}
    </div>
  );
}
