"use client";

import { useState } from "react";
import Link from "next/link";
import { useProfile } from "@/lib/hooks/use-profile";
import { SignOutButton } from "@/components/sign-out-button";

const LINKS = [
  { href: "/profile", label: "Perfil" },
  { href: "/household", label: "Hogar" },
  { href: "/settings", label: "Configuración" },
];

export function AccountMenu() {
  const { data: profile } = useProfile();
  const [open, setOpen] = useState(false);

  const initial = (profile?.full_name ?? "?")[0]?.toUpperCase();

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2 rounded-full hover:bg-surface-container px-2 py-1"
        aria-expanded={open}
        aria-label="Menú de cuenta"
      >
        {profile?.avatar_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={profile.avatar_url}
            alt=""
            className="h-9 w-9 rounded-full object-cover border border-outline-variant/30"
          />
        ) : (
          <div className="h-9 w-9 rounded-full bg-surface-container-high flex items-center justify-center text-on-surface-variant text-sm border border-outline-variant/30">
            {initial}
          </div>
        )}
      </button>

      {open && (
        <>
          <div
            className="fixed inset-0 z-10"
            onClick={() => setOpen(false)}
          />
          <div className="absolute right-0 mt-2 w-48 glass-panel rounded-lg shadow-lg z-20 py-2 flex flex-col">
            {LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setOpen(false)}
                className="px-4 py-2 text-sm text-on-surface hover:bg-surface-container-lowest"
              >
                {link.label}
              </Link>
            ))}
            <div className="px-4 py-2 border-t border-outline-variant/20 mt-1 pt-2">
              <SignOutButton />
            </div>
          </div>
        </>
      )}
    </div>
  );
}
