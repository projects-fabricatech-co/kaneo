import { useInfiniteQuery } from "@tanstack/react-query";
import listCustomers from "@/fetchers/customer/list-customers";

export const customersQueryKey = (storeId: string, q: string) =>
  ["customers", storeId, q] as const;

/**
 * Cursor pagination, not offset: the counter keeps enrolling people while the
 * owner scrolls, and an offset would shift every row down a page each time.
 *
 * The search term is part of the key so a new term starts a fresh list instead
 * of appending to the previous one.
 */
function useListCustomers(storeId: string | null, q = "") {
  return useInfiniteQuery({
    queryKey: customersQueryKey(storeId ?? "", q),
    queryFn: ({ pageParam }) =>
      listCustomers({
        storeId: storeId as string,
        q: q || undefined,
        cursor: pageParam,
      }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => last.nextCursor ?? undefined,
    enabled: Boolean(storeId),
  });
}

export default useListCustomers;
