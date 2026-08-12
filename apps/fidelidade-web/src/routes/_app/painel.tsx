import { createFileRoute, Link } from "@tanstack/react-router";
import { Stamp, Ticket } from "lucide-react";
import { StampsChart } from "@/components/dashboard/stamps-chart";
import { StatTiles } from "@/components/dashboard/stat-tiles";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import useDashboard from "@/hooks/queries/dashboard/use-dashboard";
import useStampsByDay from "@/hooks/queries/dashboard/use-stamps-by-day";
import useListStores from "@/hooks/queries/store/use-list-stores";
import { authClient } from "@/lib/auth-client";
import { copy } from "@/lib/copy";
import { useActiveStore } from "@/stores/active-store";

export const Route = createFileRoute("/_app/painel")({
  component: PainelRoute,
});

/** Keys only — the loading grid mirrors the seven tiles so the layout holds still. */
const SKELETON_TILES = ["a", "b", "c", "d", "e", "f", "g"];

function PainelRoute() {
  const { data: session } = authClient.useSession();
  const { data: stores } = useListStores();
  const { storeId } = useActiveStore();
  const { data: summary, error: summaryError } = useDashboard(storeId);
  const { data: days } = useStampsByDay(storeId);

  const activeStore = stores?.find((store) => store.id === storeId);
  const firstName = session?.user?.name?.trim().split(/\s+/)[0];

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">
          {firstName
            ? copy.painel.greeting(firstName)
            : copy.painel.greetingFallback}
        </h1>
        <p className="text-sm text-muted-foreground">{copy.painel.subtitle}</p>
      </header>

      {activeStore ? (
        <p className="text-sm text-muted-foreground">
          {copy.painel.storeLabel}:{" "}
          <span className="font-medium text-foreground">
            {activeStore.name}
          </span>
        </p>
      ) : null}

      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-medium">{copy.painel.quickActionsTitle}</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <Button
            render={<Link to="/carimbar" />}
            size="lg"
            className="justify-start"
          >
            <Stamp aria-hidden="true" className="size-5" />
            {copy.nav.carimbar}
          </Button>
          <Button
            render={<Link to="/validar" />}
            size="lg"
            variant="outline"
            className="justify-start"
          >
            <Ticket aria-hidden="true" className="size-5" />
            {copy.nav.validar}
          </Button>
        </div>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-medium">{copy.painel.tilesTitle}</h2>
        {summaryError ? (
          <Alert variant="error">
            <AlertDescription>{copy.painel.error}</AlertDescription>
          </Alert>
        ) : summary ? (
          <StatTiles summary={summary} />
        ) : (
          <div className="grid grid-cols-2 gap-3">
            {SKELETON_TILES.map((tile) => (
              <Skeleton key={tile} className="h-24 w-full rounded-xl" />
            ))}
          </div>
        )}
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-medium">{copy.painel.chartTitle}</h2>
        {days ? (
          <StampsChart days={days} />
        ) : (
          <Skeleton className="h-40 w-full rounded-xl" />
        )}
      </section>
    </div>
  );
}

export default PainelRoute;
