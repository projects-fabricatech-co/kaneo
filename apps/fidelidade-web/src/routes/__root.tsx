import type { QueryClient } from "@tanstack/react-query";
import { createRootRouteWithContext, Outlet } from "@tanstack/react-router";
import { ToastProvider } from "@/components/ui/toast";

export const Route = createRootRouteWithContext<{
  queryClient: QueryClient;
}>()({
  component: RootComponent,
});

/**
 * Deliberately NOT Kaneo's `h-svh overflow-hidden` shell: the public customer
 * card and the landing page have to scroll naturally on a phone. The fixed
 * height app chrome belongs to `_app.tsx`, not here.
 */
function RootComponent() {
  return (
    <ToastProvider position="bottom-right">
      <div className="min-h-svh w-full bg-background text-foreground">
        <Outlet />
      </div>
    </ToastProvider>
  );
}

export default RootComponent;
