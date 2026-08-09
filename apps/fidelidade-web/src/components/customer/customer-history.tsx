import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { copy } from "@/lib/copy";
import { formatDate } from "@/lib/format";

export type HistoryCard = {
  id: string;
  cycle: number;
  stampsCount: number;
  stampsRequired: number;
  status: string;
  completedAt: string | null;
};

export type HistoryReward = {
  id: string;
  code: string;
  description: string;
  status: string;
  expiresAt: string | null;
  redeemedAt: string | null;
};

export type HistoryCoupon = {
  id: string;
  code: string;
  title: string;
  discountLabel: string;
  status: string;
  expiresAt: string | null;
  redeemedAt: string | null;
};

export type CustomerHistory = {
  cards: HistoryCard[];
  rewards: HistoryReward[];
  coupons: HistoryCoupon[];
  totals: {
    totalStamps: number;
    totalRewards: number;
    totalRedeemed: number;
  };
};

/**
 * Server statuses are English enum values; the counter is not. Anything not
 * mapped falls through as-is rather than rendering blank, so a status added
 * later shows up looking wrong instead of disappearing.
 */
const STATUS_LABELS: Record<string, string> = {
  active: copy.status.active,
  completed: copy.status.completed,
  pending: copy.status.pending,
  redeemed: copy.status.redeemed,
  expired: copy.status.expired,
  archived: copy.status.archived,
  draft: copy.status.draft,
};

function statusLabel(status: string): string {
  return STATUS_LABELS[status] ?? status;
}

function statusVariant(status: string) {
  if (status === "redeemed" || status === "completed") return "secondary";
  if (status === "expired" || status === "archived") return "outline";
  return "default";
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="flex flex-col gap-2">
      <h3 className="text-sm font-medium">{title}</h3>
      {children}
    </section>
  );
}

export function CustomerHistoryView({ history }: { history: CustomerHistory }) {
  const isEmpty =
    history.cards.length === 0 &&
    history.rewards.length === 0 &&
    history.coupons.length === 0;

  if (isEmpty) {
    return (
      <p className="py-6 text-center text-sm text-muted-foreground">
        {copy.customers.historyEmpty}
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      <dl className="grid grid-cols-3 gap-2 text-center">
        <div>
          <dt className="text-xs text-muted-foreground">
            {copy.customers.totalStamps}
          </dt>
          <dd className="text-xl font-semibold tabular-nums">
            {history.totals.totalStamps}
          </dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground">
            {copy.customers.totalRewards}
          </dt>
          <dd className="text-xl font-semibold tabular-nums">
            {history.totals.totalRewards}
          </dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground">
            {copy.customers.totalRedeemed}
          </dt>
          <dd className="text-xl font-semibold tabular-nums">
            {history.totals.totalRedeemed}
          </dd>
        </div>
      </dl>

      <Separator />

      {history.cards.length > 0 ? (
        <Section title={copy.customers.cardsTitle}>
          <ul className="flex flex-col gap-2">
            {history.cards.map((card) => (
              <li
                key={card.id}
                className="flex items-center justify-between gap-3 text-sm"
              >
                <div className="flex min-w-0 flex-col">
                  <span className="font-medium">
                    {copy.customers.cardCycle(card.cycle)}
                  </span>
                  <span className="text-muted-foreground">
                    {copy.customers.cardProgress(
                      card.stampsCount,
                      card.stampsRequired,
                    )}
                  </span>
                </div>
                <Badge variant={statusVariant(card.status)}>
                  {statusLabel(card.status)}
                </Badge>
              </li>
            ))}
          </ul>
        </Section>
      ) : null}

      {history.rewards.length > 0 ? (
        <Section title={copy.customers.rewardsTitle}>
          <ul className="flex flex-col gap-2">
            {history.rewards.map((reward) => (
              <li
                key={reward.id}
                className="flex items-center justify-between gap-3 text-sm"
              >
                <div className="flex min-w-0 flex-col">
                  <span className="truncate font-medium">
                    {reward.description}
                  </span>
                  <span className="font-mono text-xs text-muted-foreground">
                    {reward.code}
                    {reward.redeemedAt
                      ? ` · ${formatDate(reward.redeemedAt)}`
                      : ""}
                  </span>
                </div>
                <Badge variant={statusVariant(reward.status)}>
                  {statusLabel(reward.status)}
                </Badge>
              </li>
            ))}
          </ul>
        </Section>
      ) : null}

      {history.coupons.length > 0 ? (
        <Section title={copy.customers.couponsTitle}>
          <ul className="flex flex-col gap-2">
            {history.coupons.map((coupon) => (
              <li
                key={coupon.id}
                className="flex items-center justify-between gap-3 text-sm"
              >
                <div className="flex min-w-0 flex-col">
                  <span className="truncate font-medium">{coupon.title}</span>
                  <span className="font-mono text-xs text-muted-foreground">
                    {coupon.code} · {coupon.discountLabel}
                  </span>
                </div>
                <Badge variant={statusVariant(coupon.status)}>
                  {statusLabel(coupon.status)}
                </Badge>
              </li>
            ))}
          </ul>
        </Section>
      ) : null}
    </div>
  );
}

export default CustomerHistoryView;
