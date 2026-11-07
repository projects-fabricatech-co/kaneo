import { createFileRoute } from "@tanstack/react-router";
import {
  Building2,
  CreditCard,
  Stamp,
  TrendingDown,
  TrendingUp,
  Users,
} from "lucide-react";
import { MetricTile } from "@/components/admin/metric-tile";
import { StampsChart } from "@/components/dashboard/stamps-chart";
import { planName } from "@/components/plans/catalogue";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import usePlatformMetrics, {
  usePlatformStampsByDay,
} from "@/hooks/queries/admin/use-platform-metrics";
import { copy } from "@/lib/copy";
import { formatCurrency, formatNumber, formatPercent } from "@/lib/format";

export const Route = createFileRoute("/admin/")({
  component: AdminMetricsRoute,
});

/** Keys only — the skeleton mirrors the tile count so the grid holds still. */
const SKELETON_TILES = ["a", "b", "c", "d", "e", "f", "g", "h", "i", "j"];

function AdminMetricsRoute() {
  const { data: metrics, error } = usePlatformMetrics();
  const { data: days } = usePlatformStampsByDay();

  if (error) {
    return (
      <Alert variant="error">
        <AlertDescription>{copy.admin.error}</AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-8">
      <header className="flex flex-col gap-1">
        <h1 className="font-heading text-2xl font-bold tracking-tight">
          {copy.admin.metricsTitle}
        </h1>
        <p className="text-sm text-muted-foreground">
          {metrics ? copy.admin.metricsSubtitle(metrics.timezone) : " "}
        </p>
      </header>

      {metrics ? (
        <>
          <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <MetricTile
              label={copy.admin.mrr}
              value={formatCurrency(metrics.mrrCents)}
              hint={copy.admin.mrrHint}
              icon={CreditCard}
            />
            <MetricTile
              label={copy.admin.payingAccounts}
              value={formatNumber(metrics.payingAccounts)}
            />
            <MetricTile
              label={copy.admin.trialingAccounts}
              value={formatNumber(metrics.trialingAccounts)}
            />
            <MetricTile
              label={copy.admin.pastDueAccounts}
              value={formatNumber(metrics.pastDueAccounts)}
            />

            <MetricTile
              label={copy.admin.accounts}
              value={formatNumber(metrics.accounts)}
              icon={Users}
            />
            <MetricTile
              label={copy.admin.stores}
              value={formatNumber(metrics.stores)}
              icon={Building2}
            />
            <MetricTile
              label={copy.admin.customers}
              value={formatNumber(metrics.customers)}
            />
            <MetricTile
              label={copy.admin.stampsToday}
              value={formatNumber(metrics.stampsToday)}
              icon={Stamp}
            />

            <MetricTile
              label={copy.admin.stampsWeek}
              value={formatNumber(metrics.stampsWeek)}
            />
            <MetricTile
              label={copy.admin.stampsMonth}
              value={formatNumber(metrics.stampsMonth)}
            />
            <MetricTile
              label={copy.admin.paidConversion}
              value={formatPercent(metrics.paidConversion)}
              icon={TrendingUp}
            />
            <MetricTile
              label={copy.admin.churn30d}
              value={formatPercent(metrics.churn30d)}
              icon={TrendingDown}
            />
          </section>

          <p className="text-xs text-muted-foreground">
            {copy.admin.mrrCaveat}
          </p>

          <section className="flex flex-col gap-3">
            <h2 className="text-sm font-medium">{copy.admin.chartTitle}</h2>
            <StampsChart days={days ?? []} emptyLabel={copy.admin.chartEmpty} />
          </section>

          <section className="flex flex-col gap-3">
            <h2 className="text-sm font-medium">
              {copy.admin.planBreakdownTitle}
            </h2>
            {metrics.planBreakdown.length === 0 ? (
              <Card>
                <CardContent className="py-6 text-center text-sm text-muted-foreground">
                  {copy.admin.planBreakdownEmpty}
                </CardContent>
              </Card>
            ) : (
              <Card>
                <CardContent className="p-0">
                  <ul className="divide-y divide-border">
                    {metrics.planBreakdown.map((row) => (
                      <li
                        key={`${row.plan}-${row.status}`}
                        className="flex items-center justify-between gap-3 px-4 py-3 text-sm"
                      >
                        <span className="font-medium">
                          {planName(row.plan)}
                        </span>
                        <span className="text-muted-foreground">
                          {row.status}
                        </span>
                        <span className="tabular-nums font-semibold">
                          {formatNumber(row.count)}
                        </span>
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            )}
          </section>
        </>
      ) : (
        <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {SKELETON_TILES.map((key) => (
            <Skeleton key={key} className="h-24 rounded-xl" />
          ))}
        </section>
      )}
    </div>
  );
}

export default AdminMetricsRoute;
