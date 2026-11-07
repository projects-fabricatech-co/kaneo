import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import useAuditLog from "@/hooks/queries/admin/use-audit-log";
import { copy } from "@/lib/copy";
import { formatDateTime } from "@/lib/format";

export const Route = createFileRoute("/admin/auditoria")({
  component: AdminAuditRoute,
});

const SKELETON_ROWS = ["a", "b", "c", "d", "e"];

function AdminAuditRoute() {
  const [page, setPage] = useState(0);
  const { data, error, isPlaceholderData } = useAuditLog(page);

  if (error) {
    return (
      <Alert variant="error">
        <AlertDescription>{copy.admin.error}</AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6">
      <header className="flex flex-col gap-1">
        <h1 className="font-heading text-2xl font-bold tracking-tight">
          {copy.admin.auditTitle}
        </h1>
        <p className="text-pretty text-sm text-muted-foreground">
          {copy.admin.auditSubtitle}
        </p>
      </header>

      {!data ? (
        <div className="flex flex-col gap-2">
          {SKELETON_ROWS.map((key) => (
            <Skeleton key={key} className="h-16 rounded-xl" />
          ))}
        </div>
      ) : data.entries.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            {copy.admin.auditEmpty}
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-0">
            {/* The table scrolls inside itself rather than the page: five
                columns do not fit a phone, and a console still gets opened on
                one. */}
            <div className="overflow-x-auto">
              <table className="w-full min-w-[46rem] border-collapse text-left text-sm">
                <thead>
                  <tr className="border-border border-b">
                    <th className="px-4 py-3 font-medium">
                      {copy.admin.auditWhen}
                    </th>
                    <th className="px-4 py-3 font-medium">
                      {copy.admin.auditWho}
                    </th>
                    <th className="px-4 py-3 font-medium">
                      {copy.admin.auditAction}
                    </th>
                    <th className="px-4 py-3 font-medium">
                      {copy.admin.auditTarget}
                    </th>
                    <th className="px-4 py-3 font-medium">
                      {copy.admin.auditReason}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {data.entries.map((entry) => (
                    <tr key={entry.id} className="border-border/60 border-b">
                      <td className="whitespace-nowrap px-4 py-3 tabular-nums text-muted-foreground">
                        {formatDateTime(entry.createdAt)}
                      </td>
                      <td className="px-4 py-3">{entry.adminEmail}</td>
                      <td className="px-4 py-3 font-mono text-xs">
                        {entry.action}
                      </td>
                      {/* `break-all`: the target is a CUID, one unbreakable
                          token, and a table cell cannot shrink below its
                          widest word. Left alone it pushes the table past the
                          card and takes Motivo off the right edge — the one
                          column that has to be readable, because it is the
                          justification the LGPD asks for. */}
                      <td className="break-all px-4 py-3 font-mono text-xs text-muted-foreground">
                        {entry.targetType
                          ? `${entry.targetType}:${entry.targetId ?? "—"}`
                          : copy.admin.auditNoReason}
                      </td>
                      <td className="min-w-[14rem] px-4 py-3 text-pretty text-muted-foreground">
                        {entry.reason ?? copy.admin.auditNoReason}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="flex items-center justify-between gap-3">
        <Button
          variant="outline"
          size="sm"
          disabled={page === 0 || isPlaceholderData}
          onClick={() => setPage((current) => Math.max(0, current - 1))}
        >
          {copy.admin.auditNewer}
        </Button>
        <Button
          variant="outline"
          size="sm"
          disabled={!data?.hasMore || isPlaceholderData}
          onClick={() => setPage((current) => current + 1)}
        >
          {copy.admin.auditOlder}
        </Button>
      </div>
    </div>
  );
}

export default AdminAuditRoute;
