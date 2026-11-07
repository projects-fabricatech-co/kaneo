import { useQuery } from "@tanstack/react-query";
import listAuditLog from "@/fetchers/admin/list-audit-log";

export const auditLogQueryKey = (page: number) =>
  ["admin", "audit", page] as const;

function useAuditLog(page = 0) {
  return useQuery({
    queryKey: auditLogQueryKey(page),
    queryFn: () => listAuditLog(page),
    // The log only grows, and reading it appends to it. Refetching on focus
    // would make the page rewrite its own first row every time the tab regains
    // attention.
    staleTime: 60_000,
    refetchOnWindowFocus: false,
  });
}

export default useAuditLog;
