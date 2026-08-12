import { useMutation, useQueryClient } from "@tanstack/react-query";
import createCoupon, {
  type CreateCouponRequest,
} from "@/fetchers/coupon/create-coupon";
import { couponsQueryKey } from "@/hooks/queries/coupon/use-list-coupons";

function useCreateCoupon() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: CreateCouponRequest) => createCoupon(input),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({
        queryKey: couponsQueryKey(variables.storeId),
      });
    },
  });
}

export default useCreateCoupon;
