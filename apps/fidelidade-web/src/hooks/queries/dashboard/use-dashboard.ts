import { useQuery } from "@tanstack/react-query";
import getDashboard from "@/fetchers/dashboard/get-dashboard";

export const dashboardQueryKey = (storeId: string) =>
  ["dashboard", storeId] as const;

function useDashboard(storeId: string | null) {
  return useQuery({
    queryKey: dashboardQueryKey(storeId ?? ""),
    queryFn: () => getDashboard(storeId as string),
    enabled: Boolean(storeId),
    // The painel is the screen the lojista leaves open on the counter, and the
    // counters move as their own team stamps. A short staleness beats a manual
    // refresh button they will never find.
    staleTime: 30_000,
  });
}

export default useDashboard;
