import { Link } from "@tanstack/react-router";
import { Activity, ArrowLeft, ScrollText, TrendingUp } from "lucide-react";
import type { PropsWithChildren } from "react";
import { cn } from "@/lib/cn";
import { copy } from "@/lib/copy";

type AdminShellProps = PropsWithChildren<{
  email: string;
  pathname: string;
}>;

/**
 * A dark sidebar, and nothing the lojista app has.
 *
 * "Shell própria" is a safety requirement before it is a style one: this console
 * reads across every tenant, and a screen that looks like the shop's own painel
 * is a screen somebody demos to a lojista by accident. The lojista app is a tab
 * bar at the bottom with a top nav; a permanent dark rail reads as another
 * place at a glance, from across a room.
 *
 * It is also the design system's own layout, so nothing here is invented: the
 * ink surface, the coral section labels and the muted links are the tokens that
 * already exist.
 */
const NAV = [
  { to: "/admin", label: copy.admin.navMetrics, icon: TrendingUp, exact: true },
  { to: "/admin/saude", label: copy.admin.navHealth, icon: Activity },
  { to: "/admin/auditoria", label: copy.admin.navAudit, icon: ScrollText },
] as const;

export function AdminShell({ email, pathname, children }: AdminShellProps) {
  return (
    <div className="flex min-h-svh flex-col md:flex-row">
      <a
        href="#conteudo-admin"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-card focus:px-3 focus:py-2"
      >
        {copy.shell.skipToContent}
      </a>

      <aside className="flex shrink-0 flex-col gap-6 bg-[var(--vale-ink-900)] px-4 py-5 text-[var(--vale-stone-100)] md:w-64 md:px-5 md:py-7">
        <div className="flex flex-col gap-0.5">
          <span className="font-heading text-lg font-extrabold tracking-tight">
            {copy.admin.shellTitle}
          </span>
          <span className="text-xs text-[var(--vale-stone-400)]">
            {copy.admin.shellSubtitle}
          </span>
        </div>

        <nav
          aria-label={copy.admin.shellSubtitle}
          className="flex gap-1 overflow-x-auto md:flex-col md:overflow-visible"
        >
          {NAV.map((item) => {
            const isActive = item.exact
              ? pathname === item.to
              : pathname.startsWith(item.to);
            const Icon = item.icon;

            return (
              <Link
                key={item.to}
                to={item.to}
                aria-current={isActive ? "page" : undefined}
                className={cn(
                  // 44px of touch target, per the design system's own floor.
                  "flex min-h-11 items-center gap-2 whitespace-nowrap rounded-lg px-3 py-2 text-sm font-semibold transition-colors",
                  isActive
                    ? "bg-white/10 text-white"
                    : "text-[var(--vale-stone-300)] hover:bg-white/5 hover:text-white",
                )}
              >
                <Icon aria-hidden="true" className="size-5 shrink-0" />
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="mt-auto hidden flex-col gap-3 md:flex">
          <p className="truncate text-xs text-[var(--vale-stone-400)]">
            {email}
          </p>
          <Link
            to="/painel"
            className="flex min-h-11 items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold text-[var(--vale-stone-300)] transition-colors hover:bg-white/5 hover:text-white"
          >
            <ArrowLeft aria-hidden="true" className="size-4" />
            {copy.admin.backToApp}
          </Link>
        </div>
      </aside>

      <main id="conteudo-admin" className="flex-1 px-4 py-6 md:px-8 md:py-10">
        {children}
      </main>
    </div>
  );
}

export default AdminShell;
