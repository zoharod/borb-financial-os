"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Icon } from "@/components/ui/icon";
import { AddExpenseButton } from "@/components/transactions/add-expense-button";

// Categorías salió de acá — ahora se gestiona desde dentro de Presupuesto
// (item 4/9 del feedback de producto: el módulo de Presupuesto es el
// "workspace" de categorías, no un ítem de nav aparte).
export const SIDEBAR_LINKS = [
  { href: "/dashboard", label: "Dashboard", icon: "dashboard" },
  { href: "/accounts", label: "Cuentas", icon: "account_balance_wallet" },
  { href: "/cards", label: "Tarjetas", icon: "credit_card" },
  { href: "/transactions", label: "Transacciones", icon: "swap_horiz" },
  { href: "/budgets", label: "Presupuesto", icon: "savings" },
  { href: "/cashflow", label: "Flujo de caja", icon: "timeline" },
  { href: "/goals", label: "Metas", icon: "flag" },
  { href: "/reports", label: "Reportes", icon: "bar_chart" },
];
const LINKS = SIDEBAR_LINKS;

export function Sidebar() {
  const pathname = usePathname();

  return (
    <nav className="bg-surface-container-low h-screen w-64 fixed left-0 top-0 hidden md:flex flex-col z-50">
      <div className="flex flex-col h-full py-6 px-3">
        <Link href="/dashboard" className="mb-10 px-3 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary-container flex items-center justify-center glow-active flex-shrink-0">
            <Icon name="dataset" className="text-on-primary-container" filled />
          </div>
          <div className="min-w-0">
            <h1 className="text-lg font-bold text-primary tracking-tight leading-tight truncate">
              Borb Financial OS
            </h1>
            <p className="text-xs text-on-surface-variant truncate">
              Centro financiero del hogar
            </p>
          </div>
        </Link>

        <div className="flex-1 space-y-1">
          {LINKS.map((link) => {
            const active = pathname === link.href;
            return (
              <Link
                key={link.href}
                href={link.href}
                className={`flex items-center gap-3 px-3 py-3 rounded-lg font-medium transition-colors duration-200 ${
                  active
                    ? "text-primary bg-surface-container-high glow-active border-r-2 border-primary"
                    : "text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface"
                }`}
              >
                <Icon name={link.icon} filled={active} />
                <span className="text-sm">{link.label}</span>
              </Link>
            );
          })}
        </div>

        <div className="mt-auto space-y-4">
          <AddExpenseButton className="w-full" />
          <div className="pt-4 border-t border-outline-variant/30 space-y-1">
            <Link
              href="/settings"
              className="flex items-center gap-3 px-3 py-2 rounded-lg text-on-surface-variant hover:text-on-surface transition-colors"
            >
              <Icon name="settings" size={20} />
              <span className="text-xs">Configuración</span>
            </Link>
          </div>
        </div>
      </div>
    </nav>
  );
}
