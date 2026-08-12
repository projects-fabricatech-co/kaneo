import { useQuery } from "@tanstack/react-query";
import getMySubscription from "@/fetchers/billing/get-my-subscription";

export const mySubscriptionQueryKey = (storeId: string) =>
  ["my-subscription", storeId] as const;

/**
 * Billing is owner-only, so a cashier gets a 403 here. That is not an error
 * worth retrying or shouting about — the screen falls back to the plain
 * catalogue — so the retry is off.
 */
function useMySubscription(storeId: string | null) {
  return useQuery({
    queryKey: mySubscriptionQueryKey(storeId ?? ""),
    queryFn: () => getMySubscription(storeId),
    retry: false,
  });
}

export default useMySubscription;
