import { createFileRoute } from "@tanstack/react-router";
import { Activity, Database, GitCommitHorizontal, Webhook } from "lucide-react";
import { MetricTile } from "@/components/admin/metric-tile";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import usePlatformHealth from "@/hooks/queries/admin/use-platform-health";
import { copy } from "@/lib/copy";
import { formatDateTime, formatNumber } from "@/lib/format";

export const Route = createFileRoute("/admin/saude")({
  component: AdminHealthRoute,
});

const SKELETON_TILES = ["a", "b", "c"];

function AdminHealthRoute() {
  const { data: health, error } = usePlatformHealth();

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
          {copy.admin.healthTitle}
        </h1>
        <p className="text-sm text-muted-foreground">
          {copy.admin.healthSubtitle}
        </p>
      </header>

      {!health ? (
        <section className="grid gap-3 sm:grid-cols-3">
          {SKELETON_TILES.map((key) => (
            <Skeleton key={key} className="h-24 rounded-xl" />
          ))}
        </section>
      ) : (
        <>
          <section className="flex flex-wrap items-center gap-2">
            <Badge variant={health.billingConfigured ? "success" : "warning"}>
              {health.billingConfigured
                ? copy.admin.billingConfigured
                : copy.admin.billingNotConfigured}
            </Badge>
            {/* Failures lead with the status, not the number: "0" beside a red
                badge reads as a problem for a second longer than it should. */}
            <Badge
              variant={health.webhookFailures24h > 0 ? "error" : "success"}
            >
              {health.webhookFailures24h > 0
                ? copy.admin.statusAttention
                : copy.admin.statusOk}
            </Badge>
          </section>

          <section className="grid gap-3 sm:grid-cols-3">
            <MetricTile
              label={copy.admin.webhookFailures}
              value={formatNumber(health.webhookFailures24h)}
              icon={Webhook}
            />
            <MetricTile
              label={copy.admin.databaseLatency}
              value={`${formatNumber(health.databaseLatencyMs)} ms`}
              icon={Database}
            />
            <MetricTile
              label={copy.admin.lastStripeEvent}
              value={
                health.lastStripeEventAt
                  ? formatDateTime(health.lastStripeEventAt)
                  : copy.admin.lastStripeEventNever
              }
              hint={health.lastStripeEventType ?? undefined}
              icon={Activity}
            />
          </section>

          <section className="flex flex-col gap-3">
            <h2 className="text-sm font-medium">
              {copy.admin.stripeEvents24h}
            </h2>
            {health.stripeEvents24h.length === 0 ? (
              <Card>
                <CardContent className="py-6 text-center text-sm text-muted-foreground">
                  {copy.admin.stripeEventsEmpty}
                </CardContent>
              </Card>
            ) : (
              <Card>
                <CardContent className="p-0">
                  <ul className="divide-y divide-border">
                    {health.stripeEvents24h.map((event) => (
                      <li
                        key={event.eventType}
                        className="flex items-center justify-between gap-3 px-4 py-3 text-sm"
                      >
                        <span className="truncate font-mono text-xs">
                          {event.eventType}
                        </span>
                        <span className="shrink-0 font-semibold tabular-nums">
                          {formatNumber(event.count)}
                        </span>
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            )}
          </section>

          <section className="flex flex-col gap-3">
            <h2 className="text-sm font-medium">
              {copy.admin.recentFailuresTitle}
            </h2>
            {health.recentWebhookFailures.length === 0 ? (
              <Card>
                <CardContent className="py-6 text-center text-sm text-muted-foreground">
                  {copy.admin.webhookFailuresEmpty}
                </CardContent>
              </Card>
            ) : (
              <Card>
                <CardContent className="p-0">
                  <ul className="divide-y divide-border">
                    {health.recentWebhookFailures.map((failure) => (
                      <li
                        key={failure.id}
                        className="flex flex-col gap-1 px-4 py-3 text-sm"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <span className="font-mono text-xs">
                            {failure.eventType ?? failure.eventId ?? failure.id}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {formatDateTime(failure.createdAt)}
                          </span>
                        </div>
                        <span className="font-medium">{failure.reason}</span>
                        {failure.message ? (
                          <span className="text-pretty text-xs text-muted-foreground">
                            {failure.message}
                          </span>
                        ) : null}
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            )}
          </section>

          <section className="flex flex-col gap-2">
            <h2 className="text-sm font-medium">{copy.admin.migration}</h2>
            <Card>
              <CardContent className="flex flex-wrap items-center gap-2 px-4 py-3 text-sm">
                <GitCommitHorizontal
                  aria-hidden="true"
                  className="size-4 text-muted-foreground"
                />
                {health.lastMigrationHash ? (
                  <>
                    <span className="truncate font-mono text-xs">
                      {health.lastMigrationHash}
                    </span>
                    {health.lastMigrationAt ? (
                      <span className="text-xs text-muted-foreground">
                        {formatDateTime(health.lastMigrationAt)}
                      </span>
                    ) : null}
                  </>
                ) : (
                  <span className="text-muted-foreground">
                    {copy.admin.migrationNever}
                  </span>
                )}
              </CardContent>
            </Card>
          </section>
        </>
      )}
    </div>
  );
}

export default AdminHealthRoute;
