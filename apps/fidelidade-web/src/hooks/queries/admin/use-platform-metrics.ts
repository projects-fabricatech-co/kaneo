import { useQuery } from "@tanstack/react-query";
import getPlatformMetrics from "@/fetchers/admin/get-platform-metrics";
import getPlatformStampsByDay from "@/fetchers/admin/get-platform-stamps-by-day";

export const platformMetricsQueryKey = ["admin", "metrics"] as const;
export const platformStampsQueryKey = (days: number) =>
  ["admin", "stamps-by-day", days] as const;

/**
 * A minute of staleness, not thirty seconds like the lojista's painel.
 *
 * Every fetch of this writes a row to the audit log, on purpose. A console that
 * polled aggressively would bury the accesses worth reading under its own
 * refreshes.
 */
function usePlatformMetrics() {
  return useQuery({
    queryKey: platformMetricsQueryKey,
    queryFn: getPlatformMetrics,
    staleTime: 60_000,
  });
}

export function usePlatformStampsByDay(days = 30) {
  return useQuery({
    queryKey: platformStampsQueryKey(days),
    queryFn: () => getPlatformStampsByDay(days),
    staleTime: 60_000,
  });
}

export default usePlatformMetrics;
