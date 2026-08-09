import { Card, CardContent } from "@/components/ui/card";
import { copy } from "@/lib/copy";
import { formatNumber } from "@/lib/format";

export type UsageSubscription = {
  planLabel: string;
  limits: {
    maxStores: number;
    maxCustomersPerStore: number | null;
    maxMembersPerStore: number;
  };
  usage: {
    stores: number;
    customers: number;
    members: number;
  };
};

/**
 * `null` is the API's word for unlimited, and rendering it as "0" or leaving it
 * blank would tell a paying lojista the opposite of the truth.
 */
function limitLabel(max: number | null): string {
  return max === null ? copy.plans.unlimited : formatNumber(max);
}

function Row({
  label,
  used,
  max,
}: {
  label: string;
  used: number;
  max: number | null;
}) {
  const atLimit = max !== null && used >= max;

  return (
    <div className="flex items-center justify-between gap-3 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span
        className={atLimit ? "font-medium text-destructive" : "font-medium"}
      >
        {formatNumber(used)} / {limitLabel(max)}
      </span>
    </div>
  );
}

export function UsagePanel({
  subscription,
}: {
  subscription: UsageSubscription;
}) {
  const { limits, usage } = subscription;

  return (
    <Card>
      <CardContent className="flex flex-col gap-3 py-4">
        <div className="flex items-center justify-between gap-3">
          <span className="text-sm text-muted-foreground">
            {copy.plans.currentPlan}
          </span>
          <span className="font-medium">{subscription.planLabel}</span>
        </div>

        <div className="flex flex-col gap-1.5 border-t border-border pt-3">
          <p className="text-xs font-medium text-muted-foreground">
            {copy.plans.usageTitle}
          </p>
          <Row
            label={copy.plans.usageStores}
            used={usage.stores}
            max={limits.maxStores}
          />
          <Row
            label={copy.plans.usageCustomers}
            used={usage.customers}
            max={limits.maxCustomersPerStore}
          />
          <Row
            label={copy.plans.usageMembers}
            used={usage.members}
            max={limits.maxMembersPerStore}
          />
        </div>
      </CardContent>
    </Card>
  );
}

export default UsagePanel;
