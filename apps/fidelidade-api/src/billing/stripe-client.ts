import Stripe from "stripe";
import {
  billingUnavailableError,
  requireStripeSecretKey,
  requireStripeWebhookSecret,
} from "./config";

/**
 * PINNED. An unpinned client follows whatever version Stripe rolls out next, and
 * this codebase reads `current_period_end` off the subscription ITEM — a shape
 * that only exists from the 2025-03-31 versions on. A silent version drift in
 * either direction changes the payload under `handle-webhook.ts` without a
 * single line of code changing.
 */
const STRIPE_API_VERSION = "2026-07-29.dahlia";

let client: Stripe | null = null;

/**
 * Lazy. Constructing the SDK needs a secret key, so building it at import time
 * would make merely importing a controller — in a unit test, say — fail on a
 * machine with no Stripe keys.
 */
export function getStripeClient(): Stripe {
  if (!client) {
    client = new Stripe(requireStripeSecretKey(), {
      apiVersion: STRIPE_API_VERSION,
    });
  }

  return client;
}

export type CreateCustomerParams = {
  ownerUserId: string;
  email: string;
  name?: string | null;
};

export async function createCustomer(
  params: CreateCustomerParams,
): Promise<{ customerId: string }> {
  const customer = await getStripeClient().customers.create({
    email: params.email,
    name: params.name ?? undefined,
    metadata: { ownerUserId: params.ownerUserId },
  });

  return { customerId: customer.id };
}

export type CreateCheckoutSessionParams = {
  customerId: string;
  priceId: string;
  ownerUserId: string;
  successUrl: string;
  cancelUrl: string;
};

export async function createCheckoutSession(
  params: CreateCheckoutSessionParams,
): Promise<{ checkoutUrl: string }> {
  const session = await getStripeClient().checkout.sessions.create({
    mode: "subscription",
    currency: "brl",
    locale: "pt-BR",
    customer: params.customerId,
    line_items: [{ price: params.priceId, quantity: 1 }],
    allow_promotion_codes: true,
    // The owner id is written in THREE places on purpose. `client_reference_id`
    // and the session metadata identify the account on
    // `checkout.session.completed`; `subscription_data.metadata` is copied onto
    // the Subscription itself and therefore rides along on every later
    // `customer.subscription.*` event. Without it the webhook would have to
    // match on an email — which the customer can change inside the portal.
    client_reference_id: params.ownerUserId,
    metadata: { ownerUserId: params.ownerUserId },
    subscription_data: { metadata: { ownerUserId: params.ownerUserId } },
    success_url: params.successUrl,
    cancel_url: params.cancelUrl,
  });

  if (!session.url) {
    throw billingUnavailableError(
      "Não foi possível abrir o checkout. Tente novamente em instantes.",
    );
  }

  return { checkoutUrl: session.url };
}

export type CreatePortalSessionParams = {
  customerId: string;
  returnUrl: string;
};

export async function createPortalSession(
  params: CreatePortalSessionParams,
): Promise<{ portalUrl: string }> {
  const session = await getStripeClient().billingPortal.sessions.create({
    customer: params.customerId,
    return_url: params.returnUrl,
    locale: "pt-BR",
  });

  return { portalUrl: session.url };
}

/**
 * Verifies the delivery over the RAW request bytes.
 *
 * `rawBody` must be the exact string Hono read off the wire. Anything that
 * parses and re-serialises the payload first — key order, whitespace, number
 * formatting — produces a different byte sequence and every signature fails.
 */
export function constructWebhookEvent(
  rawBody: string,
  signature: string | null,
): Stripe.Event {
  if (!signature) {
    throw new Error("missing stripe-signature header");
  }

  return getStripeClient().webhooks.constructEvent(
    rawBody,
    signature,
    requireStripeWebhookSecret(),
  );
}
