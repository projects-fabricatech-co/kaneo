import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { useEffect } from "react";
import { AppShell } from "@/components/layout/app-shell";
import { Spinner } from "@/components/ui/spinner";
import useListStores from "@/hooks/queries/store/use-list-stores";
import { authClient } from "@/lib/auth-client";
import { copy } from "@/lib/copy";
import { useActiveStore } from "@/stores/active-store";

/**
 * Auth gate for every lojista screen. A pathless layout route, so it adds no
 * URL segment — nesting a route under `_app/` is what makes it authenticated.
 *
 * `/onboarding` deliberately lives OUTSIDE this layout: it is the screen we send
 * a lojista to when they have no store yet, so putting it inside would make the
 * "no store -> onboarding" redirect loop forever.
 */
export const Route = createFileRoute("/_app")({
  beforeLoad: async ({ location }) => {
    const { data: session } = await authClient.getSession();

    if (!session) {
      throw redirect({
        to: "/auth/entrar",
        search: { redirect: location.pathname },
      });
    }

    return { session };
  },
  component: AppLayout,
});

function AppLayout() {
  const { data: stores, isPending } = useListStores();
  const { storeId, setStoreId } = useActiveStore();

  const resolvedStores = stores ?? [];
  const hasStores = resolvedStores.length > 0;
  const activeIsStale =
    storeId !== null && !resolvedStores.some((store) => store.id === storeId);

  useEffect(() => {
    if (!hasStores) {
      return;
    }
    // Adopt the first store on first load, and recover when the remembered
    // store was archived or the lojista lost access to it.
    if (storeId === null || activeIsStale) {
      setStoreId(resolvedStores[0]?.id ?? null);
    }
  }, [hasStores, storeId, activeIsStale, resolvedStores, setStoreId]);

  if (isPending) {
    return (
      <div className="flex min-h-svh items-center justify-center gap-2 text-muted-foreground">
        <Spinner className="size-4" />
        <span className="text-sm">{copy.common.loading}</span>
      </div>
    );
  }

  if (!hasStores) {
    // Rendered rather than thrown from `beforeLoad` so we don't have to fetch
    // the store list twice; the router keeps the URL and swaps the tree.
    throw redirect({ to: "/onboarding" });
  }

  return (
    <AppShell
      stores={resolvedStores.map((store) => ({
        id: store.id,
        name: store.name,
      }))}
      activeStoreId={storeId}
      onSelectStore={setStoreId}
    >
      <Outlet />
    </AppShell>
  );
}

export default AppLayout;
