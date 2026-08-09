import { useQuery } from "@tanstack/react-query";
import getCustomerHistory from "@/fetchers/customer/get-customer-history";

export const customerHistoryQueryKey = (customerId: string) =>
  ["customer-history", customerId] as const;

/** Only fetched once the lojista opens a customer, not for every row in the list. */
function useCustomerHistory(customerId: string | null) {
  return useQuery({
    queryKey: customerHistoryQueryKey(customerId ?? ""),
    queryFn: () => getCustomerHistory(customerId as string),
    enabled: Boolean(customerId),
  });
}

export default useCustomerHistory;
