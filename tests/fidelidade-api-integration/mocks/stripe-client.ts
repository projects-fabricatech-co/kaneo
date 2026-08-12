import type Stripe from "stripe";
import type {
  CreateCheckoutSessionParams,
  CreateCustomerParams,
  CreatePortalSessionParams,
} from "../../../apps/fidelidade-api/src/billing/stripe-client";

/**
 * Stand-in for `apps/fidelidade-api/src/billing/stripe-client.ts`, installed with
 * `vi.mock` by the billing integration test. Keeps the checkout / portal /
 * webhook routes exercisable with no real Stripe keys and no network, while
 * everything above it — the owner check, the customer reuse, the insert-and-claim
 * — runs for real.
 *
 * The types come from the real module on purpose: if its signatures change, this
 * stub stops compiling instead of quietly drifting out of shape.
 */

export const stripeCalls = {
  customers: [] as CreateCustomerParams[],
  checkouts: [] as CreateCheckoutSessionParams[],
  portals: [] as CreatePortalSessionParams[],
};

let customerCounter = 0;

export function resetStripeMock(): void {
  stripeCalls.customers.length = 0;
  stripeCalls.checkouts.length = 0;
  stripeCalls.portals.length = 0;
  customerCounter = 0;
}

/** Present only so the stub matches the real module's shape. */
export function getStripeClient(): Stripe {
  throw new Error("the Stripe SDK is not available in tests");
}

export async function createCustomer(
  params: CreateCustomerParams,
): Promise<{ customerId: string }> {
  stripeCalls.customers.push(params);
  customerCounter += 1;
  return { customerId: `cus_mock_${customerCounter}` };
}

export async function createCheckoutSession(
  params: CreateCheckoutSessionParams,
): Promise<{ checkoutUrl: string }> {
  stripeCalls.checkouts.push(params);
  return { checkoutUrl: "https://checkout.stripe.test/session_mock" };
}

export async function createPortalSession(
  params: CreatePortalSessionParams,
): Promise<{ portalUrl: string }> {
  stripeCalls.portals.push(params);
  return { portalUrl: "https://billing.stripe.test/portal_mock" };
}

/**
 * Parses instead of verifying an HMAC, so a test can post a plain JSON payload
 * and stay about the thing it is checking. A missing header still throws, which
 * is what keeps the route's 400 path exercised; the signature check itself is
 * covered against the real SDK in `tests/fidelidade-api/billing/`.
 */
export function constructWebhookEvent(
  rawBody: string,
  signature: string | null,
): Stripe.Event {
  if (!signature) {
    throw new Error("missing stripe-signature header");
  }

  return JSON.parse(rawBody) as Stripe.Event;
}
