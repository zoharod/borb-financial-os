"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

// undefined = todavía no se sabe (no disparar queries); null = sin sesión.
export function useAuthUserId(): string | null | undefined {
  const [userId, setUserId] = useState<string | null | undefined>(undefined);

  useEffect(() => {
    const supabase = createClient();

    supabase.auth.getUser().then(({ data }) => {
      setUserId(data.user?.id ?? null);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUserId(session?.user?.id ?? null);
    });

    return () => subscription.unsubscribe();
  }, []);

  return userId;
}
