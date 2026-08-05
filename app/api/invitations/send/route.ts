import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(request: Request) {
  const { invitationId } = await request.json();
  if (!invitationId) {
    return NextResponse.json({ error: "Falta invitationId" }, { status: 400 });
  }

  // No re-validamos el rol acá a mano: esta query usa el cliente con la
  // sesión del usuario (cookies), así que la policy de SELECT de
  // household_invitations (solo owner/admin del hogar) ya actúa como el
  // control de autorización. Si la invitación no existe o el usuario no es
  // owner/admin de ese hogar, esto devuelve null y cortamos acá.
  const supabase = await createClient();
  const { data: invitation, error: fetchError } = await supabase
    .from("household_invitations")
    .select("id, email, token, household_id, households(name)")
    .eq("id", invitationId)
    .single();

  if (fetchError || !invitation) {
    return NextResponse.json(
      { error: "Invitación no encontrada o sin permiso" },
      { status: 403 },
    );
  }

  const { origin } = new URL(request.url);
  const inviteLink = `${origin}/invite/${invitation.token}`;
  const redirectTo = `${origin}/auth/callback?next=${encodeURIComponent(
    `/invite/${invitation.token}`,
  )}`;

  const admin = createAdminClient();
  const { error: inviteError } = await admin.auth.admin.inviteUserByEmail(
    invitation.email,
    { redirectTo },
  );

  if (!inviteError) {
    return NextResponse.json({ delivered: true, inviteLink });
  }

  // Ya existe una cuenta con ese email — Supabase no permite mandarle un
  // email de "invitación" (ese flujo es solo para altas nuevas). No hay
  // proveedor de email transaccional propio en este proyecto todavía (ver
  // domain.md), así que en este caso el link seguro se genera igual pero
  // queda en manos de quien invita compartirlo directamente.
  const alreadyRegistered =
    inviteError.message?.toLowerCase().includes("already") ||
    inviteError.code === "email_exists";

  if (alreadyRegistered) {
    return NextResponse.json({ delivered: false, inviteLink });
  }

  return NextResponse.json({ error: inviteError.message }, { status: 500 });
}
