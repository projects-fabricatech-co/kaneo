import { eq } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import db from "../../database";
import { subscriptionTable } from "../../database/schema";
import {
  billingClientUrl,
  billingUnavailableError,
  isBillingConfigured,
} from "../config";
import { createPortalSession } from "../stripe-client";

/**
 * The Billing Portal is Stripe's own screen for changing a card, downloading an
 * invoice or cancelling. It needs an existing Customer, so an account that has
 * never started a checkout has nothing to open.
 */
async function createPortalSessionCtrl(
  ownerUserId: string,
): Promise<{ portalUrl: string }> {
  if (!isBillingConfigured()) {
    throw billingUnavailableError();
  }

  const [subscription] = await db
    .select({ stripeCustomerId: subscriptionTable.stripeCustomerId })
    .from(subscriptionTable)
    .where(eq(subscriptionTable.ownerUserId, ownerUserId))
    .limit(1);

  if (!subscription?.stripeCustomerId) {
    // 400, not 404: the account exists, it simply has no billing history yet.
    throw new HTTPException(400, {
      message:
        "Você ainda não tem uma assinatura. Escolha um plano para começar.",
    });
  }

  const { portalUrl } = await createPortalSession({
    customerId: subscription.stripeCustomerId,
    returnUrl: `${billingClientUrl()}/planos`,
  });

  return { portalUrl };
}

export default createPortalSessionCtrl;
