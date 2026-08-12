import type Stripe from "stripe";
import type { PlanId } from "../plans/limits";
import { type BillingInterval, resolvePrice } from "./config";

/**
 * PURE. Everything here reads a Stripe payload and nothing else, so the webhook's
 * trickiest decisions can be tested without a database or a network.
 */

function toDate(seconds: number | null | undefined): Date | null {
  return typeof seconds === "number" ? new Date(seconds * 1000) : null;
}

/** `customer` / `subscription` fields arrive either expanded or as a bare id. */
function toId(
  value: string | { id: string } | null | undefined,
): string | null {
  if (!value) {
    return null;
  }

  return typeof value === "string" ? value : value.id;
}

/**
 * `current_period_end` MOVED out of the subscription root and into each entry of
 * `items.data[]` in the 2025-03-31 API versions.
 *
 * Reading it off the root on a current payload does not throw — it is simply
 * `undefined`, so every subscription would be stored with a null period end and
 * the /planos screen would never show a renewal date. The root is still read as
 * a fallback so an event rendered under an older API version (Stripe renders
 * each event at the version in force when it was created) keeps working.
 */
export function readCurrentPeriodEnd(
  subscription: Stripe.Subscription,
): Date | null {
  const fromItem = subscription.items?.data?.find(
    (item) => typeof item.current_period_end === "number",
  )?.current_period_end;

  if (typeof fromItem === "number") {
    return toDate(fromItem);
  }

  const legacy = (subscription as unknown as { current_period_end?: unknown })
    .current_period_end;

  return typeof legacy === "number" ? toDate(legacy) : null;
}

export function readPriceId(subscription: Stripe.Subscription): string | null {
  return subscription.items?.data?.[0]?.price?.id ?? null;
}

/**
 * The subscription id an invoice belongs to. Recent API versions nest it under
 * `parent.subscription_details`; older payloads carry it at the root.
 */
export function readInvoiceSubscriptionId(
  invoice: Stripe.Invoice,
): string | null {
  const nested = invoice.parent?.subscription_details?.subscription;

  if (nested) {
    return toId(nested);
  }

  const legacy = (invoice as unknown as { subscription?: unknown })
    .subscription;

  if (typeof legacy === "string") {
    return legacy;
  }

  if (legacy && typeof legacy === "object" && "id" in legacy) {
    return String((legacy as { id: unknown }).id);
  }

  return null;
}

export type MappedSubscription = {
  plan: PlanId;
  billingInterval: BillingInterval | null;
  stripePriceId: string | null;
  stripeSubscriptionId: string;
  stripeCustomerId: string | null;
  status: string;
  currentPeriodEnd: Date | null;
  cancelAtPeriodEnd: boolean;
  canceledAt: Date | null;
  trialEndsAt: Date | null;
  ownerUserIdFromMetadata: string | null;
};

/** A Stripe subscription flattened into the columns of `subscriptions`. */
export function mapSubscription(
  subscription: Stripe.Subscription,
): MappedSubscription {
  const stripePriceId = readPriceId(subscription);
  const price = resolvePrice(stripePriceId);

  return {
    // An unrecognised price never becomes a paid plan: `resolvePrice` returns
    // null for anything not in the configured map, and Grátis is the floor.
    plan: price?.plan ?? "gratis",
    billingInterval: price?.interval ?? null,
    stripePriceId,
    stripeSubscriptionId: subscription.id,
    stripeCustomerId: toId(subscription.customer as string | { id: string }),
    status: subscription.status,
    currentPeriodEnd: readCurrentPeriodEnd(subscription),
    cancelAtPeriodEnd: subscription.cancel_at_period_end === true,
    canceledAt: toDate(subscription.canceled_at),
    // Only a subscription actually IN `trialing` has a live trial. Stripe leaves
    // `trial_end` populated after a trial converts or is cancelled, and
    // `effectivePlan` honours a future `trialEndsAt` AHEAD of the status — so
    // storing it unconditionally would keep entitling a cancelled account until
    // the old trial date rolled past.
    trialEndsAt:
      subscription.status === "trialing"
        ? toDate(subscription.trial_end)
        : null,
    ownerUserIdFromMetadata: subscription.metadata?.ownerUserId ?? null,
  };
}

export function readSessionCustomerId(
  session: Stripe.Checkout.Session,
): string | null {
  return toId(session.customer as string | { id: string } | null);
}
