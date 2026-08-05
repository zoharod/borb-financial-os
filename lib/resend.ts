import { Resend } from "resend";

// Server-side únicamente (usa RESEND_API_KEY, nunca exponer al cliente).
// Cliente perezoso, mismo patrón que lib/supabase/admin.ts — evita romper
// el build estático si la env var todavía no está configurada.
export function createResendClient() {
  return new Resend(process.env.RESEND_API_KEY);
}
