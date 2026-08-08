import { useQuery } from "@tanstack/react-query";
import getStore from "@/fetchers/store/get-store";

function useGetStore(id: string | null | undefined) {
  return useQuery({
    queryKey: ["store", id],
    queryFn: () => getStore({ id: id as string }),
    enabled: Boolean(id),
  });
}

export default useGetStore;
