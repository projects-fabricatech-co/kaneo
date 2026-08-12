import { useQuery } from "@tanstack/react-query";
import listPrograms from "@/fetchers/program/list-programs";

export const programsQueryKey = (storeId: string) =>
  ["programs", storeId] as const;

function useListPrograms(storeId: string | null) {
  return useQuery({
    queryKey: programsQueryKey(storeId ?? ""),
    queryFn: () => listPrograms(storeId as string),
    enabled: Boolean(storeId),
  });
}

export default useListPrograms;
