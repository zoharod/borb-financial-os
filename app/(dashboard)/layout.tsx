import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { SignOutButton } from "@/components/sign-out-button";
import { NavLinks } from "@/components/nav-links";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  return (
    <div className="flex min-h-full flex-col">
      <header className="flex items-center justify-between border-b border-outline-variant/20 px-6 py-4 gap-6">
        <span className="font-semibold text-on-surface whitespace-nowrap">
          Borb Financial OS
        </span>
        <NavLinks />
        <SignOutButton />
      </header>
      <main className="flex-1 p-6">{children}</main>
    </div>
  );
}
