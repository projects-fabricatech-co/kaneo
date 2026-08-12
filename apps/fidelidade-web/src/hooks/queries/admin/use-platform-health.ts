import { useQuery } from "@tanstack/react-query";
import getPlatformHealth from "@/fetchers/admin/get-platform-health";

export const platformHealthQueryKey = ["admin", "health"] as const;

/**
 * The one screen worth refreshing on its own: it answers "is it up right now".
 * Thirty seconds, and it keeps polling while the tab is in the background,
 * because the reason to leave this page open is to notice something breaking.
 */
function usePlatformHealth() {
  return useQuery({
    queryKey: platformHealthQueryKey,
    queryFn: getPlatformHealth,
    staleTime: 30_000,
    refetchInterval: 30_000,
  });
}

export default usePlatformHealth;
