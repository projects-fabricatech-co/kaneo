import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { useEffect } from "react";
import { AppShell } from "@/components/layout/app-shell";
import { Spinner } from "@/components/ui/spinner";
import listStores from "@/fetchers/store/list-stores";
import useListStores, {
  listStoresQueryKey,
} from "@/hooks/queries/store/use-list-stores";
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
  beforeLoad: async ({ location, context }) => {
    const { data: session } = await authClient.getSession();

    if (!session) {
      throw redirect({
        to: "/auth/entrar",
        search: { redirect: location.pathname },
      });
    }

    // The "no store yet" redirect belongs HERE, not in the component. A
    // `redirect()` thrown during render is not a redirect to the router — it is
    // just an exception carrying a Response, and it lands in the error boundary.
    //
    // `fetchQuery`, not `ensureQueryData`. This gate decides a redirect, and it
    // must never decide on stale data: `ensureQueryData` returns whatever is
    // cached whenever anything is cached, so right after onboarding it would
    // hand back the empty list cached by the very redirect that sent the lojista
    // there — and bounce them straight back. `fetchQuery` honours staleness, so
    // the mutation's invalidation is enough to make this see the new store,
    // while ordinary navigation inside the shell still reuses the cache.
    const stores = await context.queryClient.fetchQuery({
      queryKey: listStoresQueryKey,
      queryFn: () => listStores(),
      staleTime: 30_000,
    });

    if (stores.length === 0) {
      throw redirect({ to: "/onboarding" });
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

  // `beforeLoad` already primed this cache entry and already sent a lojista with
  // no store to /onboarding, so by the time we render there is a store. These
  // two branches only cover a background refetch and the moment a store is
  // archived in another tab.
  if (isPending || !hasStores) {
    return (
      <div className="flex min-h-svh items-center justify-center gap-2 text-muted-foreground">
        <Spinner className="size-4" />
        <span className="text-sm">{copy.common.loading}</span>
      </div>
    );
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
