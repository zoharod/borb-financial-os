import { createClient } from "@/lib/supabase/server";

export default async function DashboardPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Fase 0: confirma que RLS solo devuelve el/los household(s) del usuario
  // autenticado — sin esto, dos hogares de prueba se verían entre sí.
  const { data: households } = await supabase
    .from("household_members")
    .select("role, households(id, name)");

  return (
    <div className="max-w-2xl">
      <h1 className="text-xl font-semibold text-on-surface mb-2">
        Hola, {user?.email}
      </h1>
      <p className="text-sm text-on-surface-variant mb-6">
        Fase 0 — esqueleto autenticado. El módulo de Cuentas, Transacciones,
        Presupuesto y Categorías se construyen en Fase 1.
      </p>

      <div className="rounded-lg bg-surface-container p-6 border border-outline-variant/20">
        <h2 className="font-mono text-xs uppercase tracking-wider text-on-surface-variant mb-3">
          Households visibles (vía RLS)
        </h2>
        {households && households.length > 0 ? (
          <ul className="space-y-2">
            {households.map((h, i) => (
              <li key={i} className="text-on-surface">
                {(h.households as unknown as { name: string })?.name} — rol:{" "}
                {h.role}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-on-surface-variant text-sm">
            Este usuario no pertenece a ningún household todavía.
          </p>
        )}
      </div>
    </div>
  );
}
