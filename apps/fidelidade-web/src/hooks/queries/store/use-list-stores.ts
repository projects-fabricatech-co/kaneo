import { useQuery } from "@tanstack/react-query";
import listStores from "@/fetchers/store/list-stores";

export const listStoresQueryKey = ["stores"] as const;

function useListStores() {
  return useQuery({
    queryKey: listStoresQueryKey,
    queryFn: () => listStores(),
  });
}

export default useListStores;
