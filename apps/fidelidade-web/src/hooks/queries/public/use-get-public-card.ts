import { useQuery } from "@tanstack/react-query";
import getPublicCard from "@/fetchers/public/get-public-card";

export const publicCardQueryKey = (token: string) =>
  ["public-card", token] as const;

function useGetPublicCard(token: string) {
  return useQuery({
    queryKey: publicCardQueryKey(token),
    queryFn: () => getPublicCard(token),
    // The customer often opens this while the cashier is still stamping, so a
    // refetch when they come back to the tab is worth the request.
    refetchOnWindowFocus: true,
    retry: 1,
  });
}

export default useGetPublicCard;
