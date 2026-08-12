import {
  createFileRoute,
  Outlet,
  redirect,
  useLocation,
} from "@tanstack/react-router";
import { AdminShell } from "@/components/admin/admin-shell";
import { Spinner } from "@/components/ui/spinner";
import getAdminIdentity from "@/fetchers/admin/get-admin-identity";
import useAdminIdentity, {
  adminIdentityQueryKey,
} from "@/hooks/queries/admin/use-admin-identity";
import { authClient } from "@/lib/auth-client";
import { copy } from "@/lib/copy";

/**
 * The owner's console, deliberately OUTSIDE `_app`.
 *
 * `_app` sends anybody with no store to `/onboarding`, and the person who
 * administers the platform may well not run a shop — nesting the console under
 * that gate would bounce the one account that needs it into a wizard for
 * creating a bakery.
 *
 * The redirect for a non-admin is silent, and goes somewhere ordinary. Saying
 * "you are not an administrator" would confirm that administrators exist and
 * that this path is the way in, which is the same thing the API's 404 refuses to
 * confirm.
 */
export const Route = createFileRoute("/admin")({
  beforeLoad: async ({ context }) => {
    const { data: session } = await authClient.getSession();

    if (!session) {
      throw redirect({ to: "/auth/entrar", search: { redirect: "/admin" } });
    }

    // `fetchQuery`, not `ensureQueryData`: this decides an access redirect, and
    // deciding it on a cached answer from before a grant was revoked is the one
    // case where staleness has a security meaning.
    const identity = await context.queryClient.fetchQuery({
      queryKey: adminIdentityQueryKey,
      queryFn: getAdminIdentity,
      staleTime: 0,
    });

    if (!identity) {
      throw redirect({ to: "/painel" });
    }

    return { identity };
  },
  component: AdminLayout,
});

function AdminLayout() {
  const { data: identity, isPending } = useAdminIdentity();
  const { pathname } = useLocation();

  // `beforeLoad` already turned a non-admin away, so this only covers the
  // instant of a background refetch.
  if (isPending || !identity) {
    return (
      <div className="flex min-h-svh items-center justify-center gap-2 text-muted-foreground">
        <Spinner className="size-4" />
        <span className="text-sm">{copy.common.loading}</span>
      </div>
    );
  }

  return (
    <AdminShell email={identity.email} pathname={pathname}>
      <Outlet />
    </AdminShell>
  );
}

export default AdminLayout;
