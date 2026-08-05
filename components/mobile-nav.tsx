"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Icon } from "@/components/ui/icon";
import { SIDEBAR_LINKS } from "@/components/sidebar";
import { AddExpenseButton } from "@/components/transactions/add-expense-button";

// El Sidebar nuevo es desktop-first (hidden md:flex, ver components/sidebar.tsx
// y el pedido "refresh del UI en desktop inicialmente") — esto es el mínimo
// para no dejar la navegación principal inaccesible en mobile mientras esa
// pasada de diseño responsive todavía no se hizo.
export function MobileNav() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  return (
    <div className="md:hidden relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-10 h-10 rounded-full flex items-center justify-center text-on-surface-variant hover:bg-surface-container-high transition-colors"
        aria-label="Menú"
        aria-expanded={open}
      >
        <Icon name={open ? "close" : "menu"} />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute left-0 mt-2 w-56 glass-panel rounded-lg shadow-lg z-20 py-2 flex flex-col">
            <div className="px-4 pb-2 mb-2 border-b border-outline-variant/30" onClick={() => setOpen(false)}>
              <AddExpenseButton className="w-full" />
            </div>
            {SIDEBAR_LINKS.map((link) => {
              const active = pathname === link.href;
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  onClick={() => setOpen(false)}
                  className={`flex items-center gap-3 px-4 py-2 text-sm transition-colors ${
                    active
                      ? "text-primary font-bold"
                      : "text-on-surface hover:bg-surface-container-high"
                  }`}
                >
                  <Icon name={link.icon} size={20} filled={active} />
                  {link.label}
                </Link>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
