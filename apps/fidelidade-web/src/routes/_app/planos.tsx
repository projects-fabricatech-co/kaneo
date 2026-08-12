import { useMutation } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { PLAN_CATALOGUE } from "@/components/plans/catalogue";
import { PlanCard, type PlanId } from "@/components/plans/plan-card";
import { UsagePanel } from "@/components/plans/usage-panel";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import createCheckoutSession from "@/fetchers/billing/create-checkout-session";
import createPortalSession from "@/fetchers/billing/create-portal-session";
import useMySubscription from "@/hooks/queries/billing/use-my-subscription";
import { copy } from "@/lib/copy";
import { formatDate } from "@/lib/format";
import { toast } from "@/lib/toast";
import { useActiveStore } from "@/stores/active-store";

export const Route = createFileRoute("/_app/planos")({
  component: PlanosRoute,
});

function PlanosRoute() {
  const { storeId } = useActiveStore();
  const [interval, setInterval] = useState<"month" | "year">("month");

  // A cashier gets 403 here. The catalogue below still renders, because knowing
  // what the plans are is not privileged — only managing them is.
  const { data: subscription } = useMySubscription(storeId);

  const checkout = useMutation({
    mutationFn: (plan: PlanId) =>
      createCheckoutSession({
        plan: plan as "essencial" | "pro",
        interval: interval === "month" ? "monthly" : "annual",
      }),
    onSuccess: ({ checkoutUrl }) => {
      // A full navigation, not a new tab: Stripe sends the lojista back to the
      // success URL, and a popup blocked on mobile Safari would strand them.
      window.location.href = checkoutUrl;
    },
    onError: (error) =>
      toast.error(
        error instanceof Error ? error.message : copy.plans.checkoutError,
      ),
  });

  const portal = useMutation({
    mutationFn: createPortalSession,
    onSuccess: ({ portalUrl }) => {
      window.location.href = portalUrl;
    },
    onError: (error) =>
      toast.error(
        error instanceof Error ? error.message : copy.plans.portalError,
      ),
  });

  const currentPlan = subscription?.plan ?? null;
  const billingOff = subscription ? !subscription.billingConfigured : false;

  return (
    <div className="mx-auto flex w-full max-w-md flex-col gap-5">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">
          {copy.plans.title}
        </h1>
        <p className="text-sm text-muted-foreground">{copy.plans.subtitle}</p>
      </header>

      {billingOff ? (
        <Alert>
          <AlertDescription>{copy.plans.notConfigured}</AlertDescription>
        </Alert>
      ) : null}

      {subscription?.status === "past_due" ? (
        <Alert variant="error">
          <AlertDescription>{copy.plans.pastDue}</AlertDescription>
        </Alert>
      ) : null}

      {subscription ? <UsagePanel subscription={subscription} /> : null}

      {subscription?.currentPeriodEnd ? (
        <p className="text-center text-sm text-muted-foreground">
          {subscription.cancelAtPeriodEnd
            ? `${copy.plans.canceling} · ${copy.plans.endsAt(
                formatDate(subscription.currentPeriodEnd),
              )}`
            : copy.plans.renewsAt(formatDate(subscription.currentPeriodEnd))}
        </p>
      ) : null}

      <div className="flex flex-col gap-2">
        <div className="flex gap-2">
          <Button
            variant={interval === "month" ? "default" : "outline"}
            className="flex-1"
            onClick={() => setInterval("month")}
          >
            {copy.plans.monthly}
          </Button>
          <Button
            variant={interval === "year" ? "default" : "outline"}
            className="flex-1"
            onClick={() => setInterval("year")}
          >
            {copy.plans.annual}
          </Button>
        </div>
        <p className="text-center text-xs text-muted-foreground">
          {copy.plans.annualHint}
        </p>
      </div>

      <ul className="flex flex-col gap-4">
        {PLAN_CATALOGUE.map((offer) => (
          <li key={offer.id}>
            <PlanCard
              offer={offer}
              interval={interval}
              isCurrent={offer.id === currentPlan}
              // No keys configured means no Checkout to open; showing a button
              // that can only fail is worse than showing none.
              onChoose={billingOff ? undefined : checkout.mutate}
              busy={checkout.isPending}
            />
          </li>
        ))}
      </ul>

      {subscription?.hasStripeCustomer ? (
        <div className="flex flex-col gap-2">
          <Button
            variant="outline"
            onClick={() => portal.mutate()}
            loading={portal.isPending}
          >
            {portal.isPending ? copy.plans.opening : copy.plans.manage}
          </Button>
          <p className="text-center text-xs text-muted-foreground">
            {copy.plans.downgradeHint}
          </p>
        </div>
      ) : null}
    </div>
  );
}

export default PlanosRoute;
