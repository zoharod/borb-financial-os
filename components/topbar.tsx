import { GlobalSearch } from "@/components/global-search";
import { AccountMenu } from "@/components/account-menu";
import { MobileNav } from "@/components/mobile-nav";
import { Icon } from "@/components/ui/icon";

export function Topbar() {
  return (
    <header className="bg-surface fixed top-0 right-0 w-full md:w-[calc(100%-16rem)] z-40">
      <div className="flex justify-between items-center h-16 px-4 md:px-6 gap-4">
        <MobileNav />
        <GlobalSearch />
        <div className="flex items-center gap-2 ml-auto">
          <button
            className="w-10 h-10 rounded-full flex items-center justify-center text-on-surface-variant hover:bg-surface-container-high transition-colors"
            aria-label="Notificaciones"
            title="Notificaciones (configurables en Settings > Notificaciones)"
          >
            <Icon name="notifications" />
          </button>
          <AccountMenu />
        </div>
      </div>
    </header>
  );
}
