import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Sidebar } from "@/components/sidebar";
import { Topbar } from "@/components/topbar";
import { OnboardingGuard } from "@/components/onboarding-guard";

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
    <div className="min-h-full flex">
      <Sidebar />
      <div className="flex-1 md:ml-64 min-h-screen flex flex-col relative">
        <Topbar />
        {/* pt-16 y px/pb por separado, nunca "p-*" a secas acá: un shorthand
            de padding-en-todos-los-lados compite por padding-top contra
            pt-16 y gana en el CSS generado de Tailwind sin importar el orden
            en el className — bug real encontrado al ver botones "+ Agregar"
            tapados por el TopBar fijo (los primeros ~40px de cada página
            quedaban debajo del TopBar, sin poder hacerles click). */}
        <main className="flex-1 pt-16 px-4 md:px-6 pb-4 md:pb-6 flex flex-col max-w-[1600px] w-full mx-auto">
          <OnboardingGuard>{children}</OnboardingGuard>
        </main>
      </div>
    </div>
  );
}
