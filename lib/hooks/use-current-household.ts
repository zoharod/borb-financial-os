"use client";

import { useQuery } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { useAuthUserId } from "@/lib/hooks/use-auth-user-id";

export function useCurrentHousehold() {
  const userId = useAuthUserId();

  return useQuery({
    // La queryKey incluye userId: sin esto, si dos usuarios de households
    // distintos usan el mismo navegador (o el mismo perfil de dev), la
    // cache persistida en IndexedDB de un usuario queda pegada y se le
    // sirve al otro (bug real encontrado en Fase 1, ver project_state.md).
    queryKey: ["current-household", userId],
    enabled: !!userId,
    queryFn: async () => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("household_members")
        .select("household_id, role, households(name, base_currency_default)")
        .limit(1)
        .single();

      if (error) throw error;
      return data;
    },
  });
}
