import { useQuery } from "@tanstack/react-query";
import getStampsByDay, {
  DEFAULT_CHART_DAYS,
} from "@/fetchers/dashboard/get-stamps-by-day";

export const stampsByDayQueryKey = (storeId: string, days: number) =>
  ["stamps-by-day", storeId, days] as const;

function useStampsByDay(storeId: string | null, days = DEFAULT_CHART_DAYS) {
  return useQuery({
    queryKey: stampsByDayQueryKey(storeId ?? "", days),
    queryFn: () => getStampsByDay(storeId as string, days),
    enabled: Boolean(storeId),
    staleTime: 60_000,
  });
}

export default useStampsByDay;
