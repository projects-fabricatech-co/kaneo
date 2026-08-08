import { Link, useLocation } from "@tanstack/react-router";
import { LayoutDashboard, Stamp, Ticket, Users } from "lucide-react";
import { cn } from "@/lib/cn";
import { copy } from "@/lib/copy";

/**
 * Primary navigation on a phone. The lojista uses this one-handed at the
 * counter, so the destinations sit at the bottom within thumb reach rather than
 * behind a hamburger.
 *
 * `Carimbar` is the money action and is visually promoted.
 */
const items = [
  {
    to: "/painel",
    label: copy.nav.painel,
    icon: LayoutDashboard,
    primary: false,
  },
  { to: "/carimbar", label: copy.nav.carimbar, icon: Stamp, primary: true },
  { to: "/validar", label: copy.nav.validar, icon: Ticket, primary: false },
  { to: "/clientes", label: copy.nav.clientes, icon: Users, primary: false },
] as const;

export function BottomNav() {
  const { pathname } = useLocation();

  return (
    <nav
      aria-label={copy.shell.primaryNav}
      className="sticky bottom-0 z-20 border-t border-border bg-card pb-[env(safe-area-inset-bottom)] md:hidden"
    >
      <ul className="flex items-stretch">
        {items.map((item) => {
          const isActive = pathname.startsWith(item.to);
          const Icon = item.icon;

          return (
            <li key={item.to} className="flex-1">
              <Link
                to={item.to}
                aria-current={isActive ? "page" : undefined}
                className={cn(
                  "flex min-h-14 flex-col items-center justify-center gap-1 text-xs font-medium transition-colors",
                  isActive
                    ? "text-primary"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                <Icon
                  aria-hidden="true"
                  className={cn("size-5", item.primary && "size-6")}
                />
                <span>{item.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

export default BottomNav;
