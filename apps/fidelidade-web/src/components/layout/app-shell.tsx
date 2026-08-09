import { Link, useLocation } from "@tanstack/react-router";
import type { PropsWithChildren } from "react";
import { BottomNav } from "@/components/layout/bottom-nav";
import { StoreSwitcher } from "@/components/layout/store-switcher";
import { UserMenu } from "@/components/layout/user-menu";
import { cn } from "@/lib/cn";
import { copy } from "@/lib/copy";

type AppShellProps = PropsWithChildren<{
  stores: { id: string; name: string }[];
  activeStoreId: string | null;
  onSelectStore: (storeId: string) => void;
}>;

const desktopNav = [
  { to: "/painel", label: copy.nav.painel },
  { to: "/carimbar", label: copy.nav.carimbar },
  { to: "/validar", label: copy.nav.validar },
  { to: "/clientes", label: copy.nav.clientes },
  { to: "/programa", label: copy.nav.programa },
  { to: "/cupons", label: copy.nav.cupons },
  { to: "/planos", label: copy.nav.planos },
] as const;

export function AppShell({
  stores,
  activeStoreId,
  onSelectStore,
  children,
}: AppShellProps) {
  const { pathname } = useLocation();

  return (
    <div className="flex min-h-svh flex-col">
      <a
        href="#conteudo"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-card focus:px-3 focus:py-2"
      >
        {copy.shell.skipToContent}
      </a>

      <header className="sticky top-0 z-20 flex h-14 items-center gap-3 border-b border-border bg-card px-4">
        <StoreSwitcher
          stores={stores}
          activeStoreId={activeStoreId}
          onSelect={onSelectStore}
        />

        <nav
          aria-label={copy.shell.primaryNav}
          className="ml-auto hidden items-center gap-1 md:flex"
        >
          {desktopNav.map((item) => {
            const isActive = pathname.startsWith(item.to);
            return (
              <Link
                key={item.to}
                to={item.to}
                aria-current={isActive ? "page" : undefined}
                className={cn(
                  "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                  isActive
                    ? "bg-muted text-foreground"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className={cn("ml-auto md:ml-0")}>
          <UserMenu />
        </div>
      </header>

      <main id="conteudo" className="flex-1 px-4 py-5">
        {children}
      </main>

      <BottomNav />
    </div>
  );
}

export default AppShell;
