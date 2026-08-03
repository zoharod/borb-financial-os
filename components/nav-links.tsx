"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/accounts", label: "Cuentas" },
  { href: "/categories", label: "Categorías" },
  { href: "/transactions", label: "Transacciones" },
  { href: "/budgets", label: "Presupuesto" },
];

export function NavLinks() {
  const pathname = usePathname();

  return (
    <nav className="flex gap-1">
      {LINKS.map((link) => {
        const active = pathname === link.href;
        return (
          <Link
            key={link.href}
            href={link.href}
            className={`rounded-full px-3 py-1.5 text-sm transition-colors ${
              active
                ? "bg-secondary-container text-on-secondary-container"
                : "text-on-surface-variant hover:text-on-surface"
            }`}
          >
            {link.label}
          </Link>
        );
      })}
    </nav>
  );
}
