import { Gift, MapPin } from "lucide-react";
import { QrCode } from "@/components/card/qr-code";
import { StampGrid } from "@/components/card/stamp-grid";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { copy } from "@/lib/copy";
import { formatDate } from "@/lib/format";
import type { PublicCard, PublicCardEntry } from "@/types/public-card";

type PublicCardViewProps = {
  data: PublicCard;
};

function StampCard({ entry }: { entry: PublicCardEntry }) {
  const missing = Math.max(0, entry.stampsRequired - entry.stampsCount);
  const isComplete = entry.status === "completed" || missing === 0;

  return (
    <Card
      // The store's colors are applied as CSS variables so StampGrid can pick
      // them up without threading props through.
      style={
        {
          backgroundColor: entry.cardColor,
          color: entry.cardTextColor,
          "--stamp-fill": entry.cardTextColor,
          "--stamp-on-fill": entry.cardColor,
        } as React.CSSProperties
      }
      className="border-none shadow-sm"
    >
      <CardHeader className="gap-1 pb-2">
        <p className="text-sm font-medium opacity-80">{entry.programName}</p>
        <div className="flex items-baseline justify-between gap-2">
          <p className="text-lg font-semibold">
            {copy.card.stampsOf(entry.stampsCount, entry.stampsRequired)}
          </p>
          <span className="text-sm font-medium opacity-90">
            {isComplete ? copy.card.complete : copy.card.remaining(missing)}
          </span>
        </div>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <StampGrid count={entry.stampsCount} goal={entry.stampsRequired} />
        <p className="flex items-start gap-1.5 text-sm opacity-90">
          <Gift aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
          <span>{entry.rewardDescription}</span>
        </p>
      </CardContent>
    </Card>
  );
}

/**
 * What the end customer sees. No account, no password — they arrived here from a
 * link or a QR code, on a phone, probably standing in the shop.
 */
export function PublicCardView({ data }: PublicCardViewProps) {
  const { store, customer, cards, rewards, coupons } = data;

  return (
    <div className="mx-auto flex w-full max-w-md flex-col gap-5 px-4 py-6">
      <header className="flex items-center gap-3">
        {store.logoUrl ? (
          <img
            src={store.logoUrl}
            alt=""
            className="size-12 shrink-0 rounded-lg object-cover"
          />
        ) : (
          <div
            aria-hidden="true"
            className="flex size-12 shrink-0 items-center justify-center rounded-lg text-lg font-semibold"
            style={{
              backgroundColor: store.brandColor,
              color: store.brandTextColor,
            }}
          >
            {store.name.slice(0, 1).toUpperCase()}
          </div>
        )}
        <div className="flex min-w-0 flex-col">
          <h1 className="truncate text-xl font-semibold tracking-tight">
            {store.name}
          </h1>
          <p className="text-sm text-muted-foreground">
            {customer.firstName
              ? `${customer.firstName} · ${customer.phoneMasked}`
              : customer.phoneMasked}
          </p>
        </div>
      </header>

      {rewards.length > 0 ? (
        <section className="flex flex-col gap-3">
          <h2 className="text-sm font-medium">{copy.card.rewardLabel}</h2>
          {rewards.map((reward) => (
            <Card key={reward.code} className="border-primary/40 bg-primary/5">
              <CardContent className="flex flex-col items-center gap-2 py-5">
                <p className="text-center text-sm text-muted-foreground">
                  {copy.card.rewardCodeLabel}
                </p>
                <p className="font-mono text-3xl font-bold tracking-[0.2em] tabular-nums">
                  {reward.code}
                </p>
                <p className="text-center text-sm">{reward.description}</p>
                {reward.expiresAt ? (
                  <p className="text-xs text-muted-foreground">
                    {copy.card.expiresAt(formatDate(reward.expiresAt))}
                  </p>
                ) : null}
              </CardContent>
            </Card>
          ))}
        </section>
      ) : null}

      <section className="flex flex-col gap-3">
        {cards.map((entry) => (
          <StampCard
            key={`${entry.programName}-${entry.cycle}`}
            entry={entry}
          />
        ))}
      </section>

      <Separator />

      <section className="flex flex-col items-center gap-2">
        <h2 className="text-sm font-medium">{copy.card.identifyTitle}</h2>
        <p className="text-center text-sm text-muted-foreground">
          {copy.card.identifyHint}
        </p>
        <QrCode
          value={data.token}
          size={200}
          label={copy.card.identifyTitle}
          className="mt-1"
        />
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-sm font-medium">{copy.card.couponsTitle}</h2>
        {coupons.length === 0 ? (
          <p className="text-sm text-muted-foreground">{copy.card.noCoupons}</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {coupons.map((coupon) => (
              <li key={coupon.title}>
                <Card>
                  <CardContent className="flex items-center justify-between gap-3 py-3">
                    <div className="flex min-w-0 flex-col">
                      <p className="truncate text-sm font-medium">
                        {coupon.title}
                      </p>
                      {coupon.endsAt ? (
                        <p className="text-xs text-muted-foreground">
                          {copy.card.expiresAt(formatDate(coupon.endsAt))}
                        </p>
                      ) : null}
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-1">
                      <Badge>{coupon.discountLabel}</Badge>
                      {coupon.myCode ? (
                        <span className="font-mono text-sm font-semibold tracking-wider">
                          {coupon.myCode}
                        </span>
                      ) : null}
                    </div>
                  </CardContent>
                </Card>
              </li>
            ))}
          </ul>
        )}
      </section>

      <footer className="flex flex-col gap-1 pb-2 text-center text-xs text-muted-foreground">
        {store.city ? (
          <p className="flex items-center justify-center gap-1">
            <MapPin aria-hidden="true" className="size-3" />
            {store.city}
          </p>
        ) : null}
        <p>{copy.card.savedHint}</p>
        <p className="pt-1 opacity-70">{copy.card.poweredBy}</p>
      </footer>
    </div>
  );
}

export default PublicCardView;
