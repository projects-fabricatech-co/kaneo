import { useMutation, useQueryClient } from "@tanstack/react-query";
import redeemCode, {
  type RedeemCodeRequest,
} from "@/fetchers/code/redeem-code";

function useRedeemCode() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: RedeemCodeRequest) => redeemCode(input),
    onSuccess: () => {
      // The customer may be looking at their card right now, and the dashboard's
      // pending-redemptions count just changed.
      queryClient.invalidateQueries({ queryKey: ["public-card"] });
      queryClient.invalidateQueries({ queryKey: ["rewards"] });
    },
  });
}

export default useRedeemCode;
