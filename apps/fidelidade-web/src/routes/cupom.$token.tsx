import { useMutation, useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { Ticket } from "lucide-react";
import { useState } from "react";
import { isPhoneComplete, PhoneInput } from "@/components/stamp/phone-input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import claimPublicCoupon from "@/fetchers/public/claim-public-coupon";
import getPublicCoupon from "@/fetchers/public/get-public-coupon";
import { copy } from "@/lib/copy";
import { formatDate } from "@/lib/format";
import { toast } from "@/lib/toast";

/**
 * PUBLIC. A top-level route with no `beforeLoad`, reached from a link the
 * lojista shared or a QR printed and left on the counter.
 *
 * Claiming asks for a phone, which is what turns a coupon into a customer in
 * the store's loyalty base rather than an anonymous discount.
 */
export const Route = createFileRoute("/cupom/$token")({
  component: PublicCouponRoute,
});

function NotFound() {
  return (
    <main className="mx-auto flex min-h-svh w-full max-w-md flex-col items-center justify-center gap-3 px-6 text-center">
      <h1 className="text-xl font-semibold tracking-tight">
        {copy.publicCoupon.notFoundTitle}
      </h1>
      <p className="text-sm text-muted-foreground">
        {copy.publicCoupon.notFoundBody}
      </p>
    </main>
  );
}

function PublicCouponRoute() {
  const { token } = Route.useParams();
  const [phone, setPhone] = useState("");
  const [name, setName] = useState("");

  const {
    data: campaign,
    isPending,
    isError,
  } = useQuery({
    queryKey: ["public-coupon", token],
    queryFn: () => getPublicCoupon(token),
    retry: 1,
  });

  const claim = useMutation({
    mutationFn: () =>
      claimPublicCoupon(token, { phone, name: name.trim() || undefined }),
  });

  if (isPending) {
    return (
      <main className="mx-auto flex w-full max-w-md flex-col gap-4 px-4 py-10">
        <Skeleton className="h-8 w-2/3" />
        <Skeleton className="h-40 w-full rounded-xl" />
      </main>
    );
  }

  if (isError || !campaign) {
    return <NotFound />;
  }

  const claimed = claim.data;

  return (
    <main className="mx-auto flex w-full max-w-md flex-col gap-5 px-4 py-8">
      <header className="flex flex-col items-center gap-2 text-center">
        {campaign.store.logoUrl ? (
          <img
            src={campaign.store.logoUrl}
            alt=""
            className="size-14 rounded-lg object-cover"
          />
        ) : (
          <div
            aria-hidden="true"
            className="flex size-14 items-center justify-center rounded-lg text-xl font-semibold text-white"
            style={{ backgroundColor: campaign.store.brandColor }}
          >
            {campaign.store.name.slice(0, 1).toUpperCase()}
          </div>
        )}
        <p className="text-sm text-muted-foreground">{campaign.store.name}</p>
        <h1 className="text-2xl font-semibold tracking-tight">
          {campaign.title}
        </h1>
        <Badge className="text-base">{campaign.discountLabel}</Badge>
        {campaign.description ? (
          <p className="text-sm text-muted-foreground">
            {campaign.description}
          </p>
        ) : null}
        {campaign.endsAt ? (
          <p className="text-xs text-muted-foreground">
            {copy.card.expiresAt(formatDate(campaign.endsAt))}
          </p>
        ) : null}
      </header>

      {campaign.soldOut && !claimed ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-2 py-8 text-center">
            <Ticket
              aria-hidden="true"
              className="size-8 text-muted-foreground"
            />
            <p className="font-medium">{copy.publicCoupon.soldOutTitle}</p>
            <p className="text-sm text-muted-foreground">
              {copy.publicCoupon.soldOutBody}
            </p>
          </CardContent>
        </Card>
      ) : claimed ? (
        <Card className="border-primary/40 bg-primary/5">
          <CardContent className="flex flex-col items-center gap-3 py-6 text-center">
            <p className="text-sm text-muted-foreground">
              {copy.publicCoupon.yourCode}
            </p>
            <p className="font-mono text-3xl font-bold tracking-[0.2em]">
              {claimed.code}
            </p>
            <p className="text-sm">{copy.publicCoupon.showAtStore}</p>
            {claimed.expiresAt ? (
              <p className="text-xs text-muted-foreground">
                {copy.card.expiresAt(formatDate(claimed.expiresAt))}
              </p>
            ) : null}
            <Button
              render={<a href={claimed.cardUrl} />}
              variant="outline"
              className="mt-1"
            >
              {copy.publicCoupon.seeMyCard}
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="flex flex-col gap-4 py-5">
            <div className="flex flex-col gap-1">
              <h2 className="font-medium">{copy.publicCoupon.claimTitle}</h2>
              <p className="text-sm text-muted-foreground">
                {copy.publicCoupon.claimHint}
              </p>
            </div>

            <PhoneInput
              value={phone}
              onChange={setPhone}
              disabled={claim.isPending}
            />

            <div className="flex flex-col gap-2">
              <Label htmlFor="claim-name">{copy.stamp.nameOptional}</Label>
              <Input
                id="claim-name"
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder={copy.stamp.namePlaceholder}
                disabled={claim.isPending}
                autoComplete="name"
              />
            </div>

            <Button
              size="lg"
              className="w-full"
              disabled={!isPhoneComplete(phone)}
              loading={claim.isPending}
              onClick={() => {
                claim.mutate(undefined, {
                  onError: (error) =>
                    toast.error(
                      error instanceof Error
                        ? error.message
                        : copy.publicCoupon.error,
                    ),
                });
              }}
            >
              {claim.isPending
                ? copy.publicCoupon.claiming
                : copy.publicCoupon.claimAction}
            </Button>
          </CardContent>
        </Card>
      )}
    </main>
  );
}

export default PublicCouponRoute;
