import { NextResponse } from "next/server";
import { createResendClient } from "@/lib/resend";

// Ruta de prueba manual para confirmar que la integración de Resend
// funciona — no está conectada todavía a ningún flujo real de la app (ver
// docs/project_state.md). Borrar o reemplazar cuando se decida cómo usar
// Resend de verdad (SMTP de Supabase vs. envíos propios).
export async function POST() {
  const resend = createResendClient();

  const { data, error } = await resend.emails.send({
    from: "onboarding@resend.dev",
    to: "zoharod@gmail.com",
    subject: "Hello World",
    html: "<p>Congrats on sending your <strong>first email</strong>!</p>",
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true, id: data?.id });
}
