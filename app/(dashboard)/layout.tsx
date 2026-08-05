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
        <main className="flex-1 pt-16 p-4 md:p-6 flex flex-col max-w-[1600px] w-full mx-auto">
          <OnboardingGuard>{children}</OnboardingGuard>
        </main>
      </div>
    </div>
  );
}
