"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Icon } from "@/components/ui/icon";
import { useAccounts } from "@/lib/hooks/use-accounts";
import { useCategories } from "@/lib/hooks/use-categories";

// Búsqueda real (no decorativa): filtra cuentas/categorías ya cacheadas por
// nombre y navega a su lista — no hay una IA de búsqueda semántica (eso es
// Fase 4/5, ver Command Center en project_state.md), pero tampoco es un
// input sin función.
export function GlobalSearch() {
  const { data: accounts } = useAccounts();
  const { data: categories } = useCategories();
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);

  const q = query.trim().toLowerCase();
  const matchedAccounts = q
    ? (accounts ?? []).filter((a) => a.name.toLowerCase().includes(q))
    : [];
  const matchedCategories = q
    ? (categories ?? []).filter((c) => c.name.toLowerCase().includes(q))
    : [];
  const hasResults = matchedAccounts.length > 0 || matchedCategories.length > 0;

  function goTo(href: string) {
    setQuery("");
    setOpen(false);
    router.push(href);
  }

  return (
    <div className="relative hidden md:block w-96">
      <Icon
        name="search"
        className="absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant"
        size={20}
      />
      <input
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        placeholder="Buscar cuentas o categorías..."
        className="w-full bg-surface-container-high border border-outline-variant/50 rounded-full py-2 pl-10 pr-4 text-sm text-on-surface placeholder:text-on-surface-variant focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all"
      />
      {open && q && (
        <div className="absolute mt-2 w-full glass-panel rounded-lg py-2 z-50 max-h-80 overflow-y-auto">
          {!hasResults && (
            <p className="px-4 py-2 text-sm text-on-surface-variant">
              Sin resultados para &ldquo;{query}&rdquo;
            </p>
          )}
          {matchedAccounts.length > 0 && (
            <div className="mb-1">
              <p className="px-4 py-1 text-xs uppercase tracking-wider text-on-surface-variant">
                Cuentas
              </p>
              {matchedAccounts.map((a) => (
                <button
                  key={a.id}
                  onClick={() => goTo("/accounts")}
                  className="w-full text-left px-4 py-2 text-sm text-on-surface hover:bg-surface-container-high flex items-center gap-2"
                >
                  <Icon name="account_balance_wallet" size={16} />
                  {a.name}
                </button>
              ))}
            </div>
          )}
          {matchedCategories.length > 0 && (
            <div>
              <p className="px-4 py-1 text-xs uppercase tracking-wider text-on-surface-variant">
                Categorías
              </p>
              {matchedCategories.map((c) => (
                <button
                  key={c.id}
                  onClick={() => goTo("/categories")}
                  className="w-full text-left px-4 py-2 text-sm text-on-surface hover:bg-surface-container-high flex items-center gap-2"
                >
                  <Icon name="sell" size={16} />
                  {c.name}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
