import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/supabase";

// Cliente con la service role key — SOLO server-side (API routes / route
// handlers), nunca importar desde un client component. Se crea de forma
// perezosa (dentro del handler, no en el top-level) para no romper el build
// estático cuando la env var todavía no está configurada, mismo patrón que
// lib/supabase/client.ts y server.ts.
export function createAdminClient() {
  return createSupabaseClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
}
