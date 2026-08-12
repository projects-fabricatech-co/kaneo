import { createFileRoute } from "@tanstack/react-router";
import { PublicCardView } from "@/components/card/public-card-view";
import { Skeleton } from "@/components/ui/skeleton";
import useGetPublicCard from "@/hooks/queries/public/use-get-public-card";
import { copy } from "@/lib/copy";

/**
 * The customer's card. PUBLIC: a top-level route file with no `beforeLoad`, so
 * no session is ever required — the opaque token in the URL is the credential.
 *
 * Reached from a link or a QR code, on a phone, usually in the shop.
 */
export const Route = createFileRoute("/c/$token")({
  component: PublicCardRoute,
});

function LoadingCard() {
  return (
    <div className="mx-auto flex w-full max-w-md flex-col gap-5 px-4 py-6">
      <div className="flex items-center gap-3">
        <Skeleton className="size-12 shrink-0 rounded-lg" />
        <div className="flex flex-1 flex-col gap-2">
          <Skeleton className="h-5 w-2/3" />
          <Skeleton className="h-4 w-1/2" />
        </div>
      </div>
      <Skeleton className="h-56 w-full rounded-xl" />
      <span className="sr-only">{copy.card.loading}</span>
    </div>
  );
}

function NotFoundCard() {
  return (
    <main className="mx-auto flex min-h-svh w-full max-w-md flex-col items-center justify-center gap-3 px-6 text-center">
      <h1 className="text-xl font-semibold tracking-tight">
        {copy.card.notFoundTitle}
      </h1>
      <p className="text-sm text-muted-foreground">{copy.card.notFoundBody}</p>
    </main>
  );
}

function PublicCardRoute() {
  const { token } = Route.useParams();
  const { data, isPending, isError } = useGetPublicCard(token);

  if (isPending) {
    return <LoadingCard />;
  }

  // Any failure reads the same to the customer. A revoked token and a typo in
  // the URL are the same situation from where they are standing, and
  // distinguishing them would leak whether a token ever existed.
  if (isError || !data) {
    return <NotFoundCard />;
  }

  return (
    <main>
      <PublicCardView data={data} />
    </main>
  );
}

export default PublicCardRoute;
