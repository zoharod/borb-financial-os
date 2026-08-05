"use client";

import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { del } from "idb-keyval";
import { createClient } from "@/lib/supabase/client";

export function SignOutButton() {
  const router = useRouter();
  const queryClient = useQueryClient();

  async function handleSignOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    // Limpia la cache en memoria Y la persistida en IndexedDB — sin esto,
    // si otra persona usa el mismo navegador después, podría ver por un
    // instante datos cacheados del household anterior antes del primer
    // refetch (mismo riesgo que el bug de cache cruzada de Fase 1, ver
    // architecture.md).
    queryClient.clear();
    await del("REACT_QUERY_OFFLINE_CACHE");
    router.push("/login");
    router.refresh();
  }

  return (
    <button
      onClick={handleSignOut}
      className="font-mono text-xs uppercase tracking-wider text-on-surface-variant hover:text-on-surface"
    >
      Salir
    </button>
  );
}
