import { useQuery } from "@tanstack/react-query";
import listCoupons from "@/fetchers/coupon/list-coupons";

export const couponsQueryKey = (storeId: string) =>
  ["coupons", storeId] as const;

function useListCoupons(storeId: string | null) {
  return useQuery({
    queryKey: couponsQueryKey(storeId ?? ""),
    queryFn: () => listCoupons(storeId as string),
    enabled: Boolean(storeId),
  });
}

export default useListCoupons;
