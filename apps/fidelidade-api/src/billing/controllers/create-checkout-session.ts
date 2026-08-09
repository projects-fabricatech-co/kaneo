import { eq } from "drizzle-orm";
import db from "../../database";
import { subscriptionTable } from "../../database/schema";
import {
  type BillingInterval,
  billingClientUrl,
  billingUnavailableError,
  getPriceId,
  isBillingConfigured,
  type PaidPlanId,
} from "../config";
import { createCheckoutSession, createCustomer } from "../stripe-client";

export type CreateCheckoutSessionInput = {
  plan: PaidPlanId;
  interval: BillingInterval;
};

export type CheckoutOwner = {
  userId: string;
  email: string;
  name?: string | null;
};

/**
 * Reuses the owner's Stripe customer when there is one. Creating a second
 * customer for the same account splits their invoices and their saved card
 * across two records, and the Billing Portal only ever shows one of them.
 */
async function ensureStripeCustomer(owner: CheckoutOwner): Promise<string> {
  const [existing] = await db
    .select({ stripeCustomerId: subscriptionTable.stripeCustomerId })
    .from(subscriptionTable)
    .where(eq(subscriptionTable.ownerUserId, owner.userId))
    .limit(1);

  if (existing?.stripeCustomerId) {
    return existing.stripeCustomerId;
  }

  const { customerId } = await createCustomer({
    ownerUserId: owner.userId,
    email: owner.email,
    name: owner.name ?? null,
  });

  // `plan`/`status` are deliberately NOT set to anything paid here: nothing has
  // been paid yet. The row exists only to remember the customer id, and the
  // webhook is what grants the plan.
  await db
    .insert(subscriptionTable)
    .values({
      ownerUserId: owner.userId,
      stripeCustomerId: customerId,
      plan: "gratis",
      status: "incomplete",
    })
    .onConflictDoUpdate({
      target: subscriptionTable.ownerUserId,
      set: { stripeCustomerId: customerId, updatedAt: new Date() },
    });

  return customerId;
}

async function createCheckoutSessionCtrl(
  owner: CheckoutOwner,
  input: CreateCheckoutSessionInput,
): Promise<{ checkoutUrl: string }> {
  if (!isBillingConfigured()) {
    throw billingUnavailableError();
  }

  const priceId = getPriceId(input.plan, input.interval);

  if (!priceId) {
    throw billingUnavailableError(
      "Este plano ainda não está disponível para contratação.",
    );
  }

  const customerId = await ensureStripeCustomer(owner);
  const clientUrl = billingClientUrl();

  // Concatenated, never built through `new URL()`: `{CHECKOUT_SESSION_ID}` is a
  // placeholder Stripe substitutes, and URL encoding would turn the braces into
  // %7B/%7D and hand the browser a literal placeholder.
  const { checkoutUrl } = await createCheckoutSession({
    customerId,
    priceId,
    ownerUserId: owner.userId,
    successUrl: `${clientUrl}/planos?checkout=sucesso&session_id={CHECKOUT_SESSION_ID}`,
    cancelUrl: `${clientUrl}/planos?checkout=cancelado`,
  });

  return { checkoutUrl };
}

export default createCheckoutSessionCtrl;
