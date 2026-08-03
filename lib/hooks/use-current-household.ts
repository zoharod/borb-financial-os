"use client";

import { useQuery } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";

export function useCurrentHousehold() {
  return useQuery({
    queryKey: ["current-household"],
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
