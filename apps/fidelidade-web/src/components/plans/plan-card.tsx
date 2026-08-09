import { Check, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { copy } from "@/lib/copy";
import { formatCurrency } from "@/lib/format";

export type PlanId = "gratis" | "essencial" | "pro";

export type PlanLimits = {
  maxStores: number;
  maxProgramsPerStore: number;
  maxCustomersPerStore: number | null;
  maxMembersPerStore: number;
  coupons: boolean;
  branding: boolean;
  reports: boolean;
};

export type PlanOffer = {
  id: PlanId;
  name: string;
  tagline: string;
  /** Centavos. `null` on the free plan, which has no price to show. */
  monthlyCents: number | null;
  annualCents: number | null;
  limits: PlanLimits;
};

/**
 * A feature line the lojista can actually check against their own shop, and the
 * ones a plan does NOT have are shown struck through rather than hidden.
 * Omitting them makes two plans look alike at a glance, which is exactly the
 * moment someone picks the wrong one.
 */
function featureLines(limits: PlanLimits) {
  return [
    { label: copy.plans.features.stores(limits.maxStores), included: true },
    {
      label: copy.plans.features.programs(limits.maxProgramsPerStore),
      included: true,
    },
    {
      label: copy.plans.features.customers(limits.maxCustomersPerStore),
      included: true,
    },
    {
      label: copy.plans.features.members(limits.maxMembersPerStore),
      included: true,
    },
    { label: copy.plans.features.coupons, included: limits.coupons },
    { label: copy.plans.features.branding, included: limits.branding },
    { label: copy.plans.features.reports, included: limits.reports },
  ];
}

export function PlanCard({
  offer,
  interval,
  isCurrent,
  onChoose,
  busy,
}: {
  offer: PlanOffer;
  interval: "month" | "year";
  isCurrent: boolean;
  onChoose?: (planId: PlanId) => void;
  busy?: boolean;
}) {
  const cents = interval === "month" ? offer.monthlyCents : offer.annualCents;
  const suffix =
    interval === "month" ? copy.plans.perMonth : copy.plans.perYear;

  return (
    <Card className={isCurrent ? "border-primary/50 bg-primary/5" : undefined}>
      <CardContent className="flex flex-col gap-4 py-5">
        <div className="flex items-start justify-between gap-3">
          <div className="flex flex-col">
            <h2 className="font-semibold">{offer.name}</h2>
            <p className="text-sm text-muted-foreground">{offer.tagline}</p>
          </div>
          {isCurrent ? <Badge>{copy.plans.current}</Badge> : null}
        </div>

        <p className="flex items-baseline gap-1">
          <span className="text-2xl font-semibold">
            {cents === null ? copy.plans.free : formatCurrency(cents)}
          </span>
          {cents === null ? null : (
            <span className="text-sm text-muted-foreground">{suffix}</span>
          )}
        </p>

        <ul className="flex flex-col gap-1.5">
          {featureLines(offer.limits).map((feature) => (
            <li key={feature.label} className="flex items-center gap-2 text-sm">
              {feature.included ? (
                <Check aria-hidden="true" className="size-4 text-primary" />
              ) : (
                <X
                  aria-hidden="true"
                  className="size-4 text-muted-foreground"
                />
              )}
              <span
                className={
                  feature.included
                    ? undefined
                    : "text-muted-foreground line-through"
                }
              >
                {feature.label}
              </span>
            </li>
          ))}
        </ul>

        {/* The free plan is not something you buy, and the plan you already have
            is not something you buy again. */}
        {offer.id !== "gratis" && !isCurrent && onChoose ? (
          <Button
            className="w-full"
            loading={busy}
            onClick={() => onChoose(offer.id)}
          >
            {copy.plans.choose}
          </Button>
        ) : null}
      </CardContent>
    </Card>
  );
}

export default PlanCard;
