import { useQuery } from "@tanstack/react-query";
import getAdminIdentity from "@/fetchers/admin/get-admin-identity";

export const adminIdentityQueryKey = ["admin", "identity"] as const;

/**
 * Whether the console exists for this person.
 *
 * Long staleness: an admin grant does not change while somebody is clicking
 * around, and this is fetched by the route gate on every navigation into
 * `/admin`.
 */
function useAdminIdentity() {
  return useQuery({
    queryKey: adminIdentityQueryKey,
    queryFn: getAdminIdentity,
    staleTime: 5 * 60_000,
  });
}

export default useAdminIdentity;
