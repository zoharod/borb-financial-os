"use client";

import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { Input, Label } from "@/components/ui/input";
import { useCurrentHousehold } from "@/lib/hooks/use-current-household";
import {
  useCategories,
  useCreateCategory,
  useDeleteCategory,
  useUpdateCategory,
  type Category,
} from "@/lib/hooks/use-categories";

export default function CategoriesPage() {
  const { data: household } = useCurrentHousehold();
  const { data: categories, isLoading } = useCategories();
  const createCategory = useCreateCategory();

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

  return (
    <div className="max-w-2xl">
      <h1 className="text-2xl font-bold text-on-surface tracking-tight mb-6 flex items-center gap-2">
        <Icon name="sell" className="text-primary" filled />
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
              <CategoryRow category={category} />
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

function CategoryRow({ category }: { category: Category }) {
  const updateCategory = useUpdateCategory();
  const deleteCategory = useDeleteCategory();

  const [isEditing, setIsEditing] = useState(false);
  const [name, setName] = useState(category.name);
  const [isExtraDefault, setIsExtraDefault] = useState(
    category.is_extra_default,
  );
  const [error, setError] = useState<string | null>(null);

  function startEditing() {
    setName(category.name);
    setIsExtraDefault(category.is_extra_default);
    setError(null);
    setIsEditing(true);
  }

  async function handleSave() {
    setError(null);
    try {
      await updateCategory.mutateAsync({
        id: category.id,
        name,
        is_extra_default: isExtraDefault,
      });
      setIsEditing(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al guardar");
    }
  }

  async function handleDelete() {
    if (!confirm("¿Eliminar esta categoría?")) return;
    await deleteCategory.mutateAsync(category.id);
  }

  if (isEditing) {
    return (
      <Card className="py-4">
        <div className="flex flex-col gap-3">
          <Input value={name} onChange={(e) => setName(e.target.value)} />
          <label className="flex items-center gap-2 text-sm text-on-surface-variant">
            <input
              type="checkbox"
              checked={isExtraDefault}
              onChange={(e) => setIsExtraDefault(e.target.checked)}
            />
            Usar como categoría por defecto (&quot;Extras/Imprevistos&quot;)
          </label>
          {error && (
            <p className="text-sm text-error" role="alert">
              {error}
            </p>
          )}
          <div className="flex gap-2 justify-end">
            <Button variant="secondary" onClick={() => setIsEditing(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSave} disabled={updateCategory.isPending}>
              {updateCategory.isPending ? "Guardando..." : "Guardar"}
            </Button>
          </div>
        </div>
      </Card>
    );
  }

  return (
    <Card className="flex items-center justify-between py-4">
      <div>
        <p className="text-on-surface font-medium">{category.name}</p>
        {category.is_extra_default && (
          <p className="text-on-surface-variant text-xs font-mono uppercase tracking-wider">
            Extras/Imprevistos
          </p>
        )}
      </div>
      <div className="flex gap-2">
        <Button variant="secondary" onClick={startEditing}>
          Editar
        </Button>
        <Button variant="danger" onClick={handleDelete}>
          Eliminar
        </Button>
      </div>
    </Card>
  );
}
