"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Icon } from "@/components/ui/icon";

export const SIDEBAR_LINKS = [
  { href: "/dashboard", label: "Dashboard", icon: "dashboard" },
  { href: "/accounts", label: "Cuentas", icon: "account_balance_wallet" },
  { href: "/categories", label: "Categorías", icon: "sell" },
  { href: "/transactions", label: "Transacciones", icon: "swap_horiz" },
  { href: "/budgets", label: "Presupuesto", icon: "savings" },
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
          <Link
            href="/transactions"
            className="w-full bg-primary text-on-primary py-3 px-4 rounded-full text-sm font-bold hover:brightness-110 transition-all glow-active flex items-center justify-center gap-2"
          >
            <Icon name="add" size={20} />
            Nueva transacción
          </Link>
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
