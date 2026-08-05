import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }

  const { data: membership } = await supabase
    .from("household_members")
    .select("household_id, role")
    .eq("user_id", user.id)
    .maybeSingle();

  if (membership?.role === "owner") {
    const { count } = await supabase
      .from("household_members")
      .select("id", { count: "exact", head: true })
      .eq("household_id", membership.household_id)
      .neq("user_id", user.id);

    if (count && count > 0) {
      return NextResponse.json(
        {
          error:
            "Sos el dueño de un hogar con otros miembros. Transferí la propiedad antes de eliminar tu cuenta.",
        },
        { status: 400 },
      );
    }

    // Único miembro: se borra el hogar entero junto con la cuenta (nadie
    // más queda con acceso a esos datos financieros).
    const { error: deleteHouseholdError } = await supabase.rpc(
      "delete_household",
      { target_household_id: membership.household_id },
    );
    if (deleteHouseholdError) {
      return NextResponse.json(
        { error: deleteHouseholdError.message },
        { status: 500 },
      );
    }
  }

  const admin = createAdminClient();
  const { error: deleteUserError } = await admin.auth.admin.deleteUser(
    user.id,
  );
  if (deleteUserError) {
    return NextResponse.json({ error: deleteUserError.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
