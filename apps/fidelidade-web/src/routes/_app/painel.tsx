import { createFileRoute, Link } from "@tanstack/react-router";
import { Stamp, Ticket } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import useListStores from "@/hooks/queries/store/use-list-stores";
import { authClient } from "@/lib/auth-client";
import { copy } from "@/lib/copy";
import { useActiveStore } from "@/stores/active-store";

export const Route = createFileRoute("/_app/painel")({
  component: PainelRoute,
});

function PainelRoute() {
  const { data: session } = authClient.useSession();
  const { data: stores } = useListStores();
  const { storeId } = useActiveStore();

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

      {/* Filled in by Phase 5 — the tiles need the aggregation endpoints. */}
      <Card>
        <CardHeader>
          <CardTitle>{copy.painel.tilesTitle}</CardTitle>
          <CardDescription>{copy.painel.tilesPlaceholder}</CardDescription>
        </CardHeader>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{copy.painel.activityTitle}</CardTitle>
          <CardDescription>{copy.painel.activityPlaceholder}</CardDescription>
        </CardHeader>
        <CardContent />
      </Card>
    </div>
  );
}

export default PainelRoute;
