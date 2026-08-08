/**
 * Stand-in for `apps/fidelidade-api/src/billing/stripe-client.ts`, aliased in by
 * `vitest.integration.config.ts` from Phase 6 on. Keeps the checkout / portal /
 * webhook routes exercisable with no real Stripe keys and no network.
 */

export async function createCheckoutSession(): Promise<{
  checkoutUrl: string;
}> {
  return { checkoutUrl: "https://checkout.stripe.test/session_mock" };
}

export async function createPortalSession(): Promise<{ portalUrl: string }> {
  return { portalUrl: "https://billing.stripe.test/portal_mock" };
}

/**
 * Pass-through instead of a real HMAC check, so tests can post plain JSON
 * payloads. Signature verification itself is covered by asserting that a
 * malformed signature is rejected before this is reached.
 */
export function constructWebhookEvent(rawBody: string) {
  return JSON.parse(rawBody);
}
