import { Link, useLocation } from "@tanstack/react-router";
import {
  CreditCard,
  LayoutDashboard,
  MoreHorizontal,
  Stamp,
  Ticket,
  Users,
} from "lucide-react";
import { useState } from "react";
import {
  Sheet,
  SheetHeader,
  SheetPanel,
  SheetPopup,
  SheetTitle,
} from "@/components/ui/sheet";
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

/**
 * The screens the lojista configures once and then rarely reopens. They do not
 * earn a permanent tab, but with only four tabs and no hamburger on mobile they
 * were previously unreachable on a phone entirely — which is the device this app
 * is built for.
 */
const moreItems = [
  { to: "/programa", label: copy.nav.programa, icon: Stamp },
  { to: "/cupons", label: copy.nav.cupons, icon: Ticket },
  { to: "/planos", label: copy.nav.planos, icon: CreditCard },
] as const;

export function BottomNav() {
  const { pathname } = useLocation();
  const [moreOpen, setMoreOpen] = useState(false);

  const moreActive = moreItems.some((item) => pathname.startsWith(item.to));

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

        <li className="flex-1">
          <button
            type="button"
            onClick={() => setMoreOpen(true)}
            className={cn(
              "flex min-h-14 w-full flex-col items-center justify-center gap-1 text-xs font-medium transition-colors",
              moreActive
                ? "text-primary"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            <MoreHorizontal aria-hidden="true" className="size-5" />
            <span>{copy.nav.mais}</span>
          </button>
        </li>
      </ul>

      <Sheet open={moreOpen} onOpenChange={setMoreOpen}>
        <SheetPopup side="bottom">
          <SheetHeader>
            <SheetTitle>{copy.nav.mais}</SheetTitle>
          </SheetHeader>
          <SheetPanel>
            <ul className="flex flex-col">
              {moreItems.map((item) => {
                const Icon = item.icon;

                return (
                  <li key={item.to}>
                    <Link
                      to={item.to}
                      onClick={() => setMoreOpen(false)}
                      className="flex min-h-12 items-center gap-3 rounded-lg px-2 text-sm font-medium hover:bg-muted"
                    >
                      <Icon
                        aria-hidden="true"
                        className="size-5 text-muted-foreground"
                      />
                      {item.label}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </SheetPanel>
        </SheetPopup>
      </Sheet>
    </nav>
  );
}

export default BottomNav;
