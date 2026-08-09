import { HTTPException } from "hono/http-exception";
import type { PlanId } from "../plans/limits";

export type BillingInterval = "monthly" | "annual";

/** Grátis is the absence of a subscription; it has no Stripe price. */
export type PaidPlanId = Exclude<PlanId, "gratis">;

export const PAID_PLAN_IDS = ["essencial", "pro"] as const;
export const BILLING_INTERVALS = ["monthly", "annual"] as const;

export type PriceRef = { plan: PaidPlanId; interval: BillingInterval };

/**
 * The ONE place that names a Stripe env var. Every other module asks this file,
 * so adding a plan means touching this table and nothing else.
 */
const PRICE_ENV_VARS: Record<PaidPlanId, Record<BillingInterval, string>> = {
  essencial: {
    monthly: "STRIPE_PRICE_ESSENCIAL_MONTHLY",
    annual: "STRIPE_PRICE_ESSENCIAL_ANNUAL",
  },
  pro: {
    monthly: "STRIPE_PRICE_PRO_MONTHLY",
    annual: "STRIPE_PRICE_PRO_ANNUAL",
  },
};

const DEFAULT_CLIENT_URL = "http://localhost:5174";

/**
 * Read on every call rather than snapshotted at import time. The module graph is
 * built once per process, so a snapshot would freeze whatever the very first
 * import saw — which in the test suite is the first test file's environment, and
 * in production is whatever was set before the first `import` ran.
 */
function readEnv(name: string): string | null {
  const value = process.env[name]?.trim();
  return value ? value : null;
}

export function stripeSecretKey(): string | null {
  return readEnv("STRIPE_SECRET_KEY");
}

export function stripeWebhookSecret(): string | null {
  return readEnv("STRIPE_WEBHOOK_SECRET");
}

/**
 * Both keys, not just one: a deploy with a secret key and no webhook secret can
 * take money and then never hear that it did, which is worse than billing being
 * switched off. Note that plan LIMITS do not consult this — an account with no
 * subscription is on Grátis whether or not Stripe is wired up.
 */
export function isBillingConfigured(): boolean {
  return Boolean(stripeSecretKey() && stripeWebhookSecret());
}

/** plan + interval -> Stripe price id. `null` when that price is not configured. */
export function getPriceId(
  plan: PaidPlanId,
  interval: BillingInterval,
): string | null {
  return readEnv(PRICE_ENV_VARS[plan][interval]);
}

/**
 * Stripe price id -> plan + interval, built from the same table as the forward
 * direction so the two can never disagree.
 */
export function resolvePrice(
  priceId: string | null | undefined,
): PriceRef | null {
  if (!priceId) {
    return null;
  }

  for (const plan of PAID_PLAN_IDS) {
    for (const interval of BILLING_INTERVALS) {
      if (getPriceId(plan, interval) === priceId) {
        return { plan, interval };
      }
    }
  }

  // A price we did not configure is NOT a plan. Returning null here is what
  // stops a subscription created in the Stripe dashboard — or against another
  // product's price — from silently entitling somebody to Pro.
  return null;
}

/** Base for every `success_url` / `cancel_url` / `return_url`, no trailing slash. */
export function billingClientUrl(): string {
  const configured = readEnv("FIDELIDADE_CLIENT_URL") ?? DEFAULT_CLIENT_URL;
  return configured.replace(/\/+$/, "");
}

/**
 * 503, not 500: the request was fine, the server simply has no payment provider
 * wired up. JSON via `res` because `message` renders as plain text and the web
 * client needs to tell this apart from a plan limit.
 */
export function billingUnavailableError(
  message = "Pagamentos ainda não estão disponíveis. Fale com o suporte.",
): HTTPException {
  return new HTTPException(503, {
    res: Response.json(
      { error: "billing_not_configured", message },
      { status: 503 },
    ),
  });
}

export function requireStripeSecretKey(): string {
  const key = stripeSecretKey();

  if (!key) {
    throw billingUnavailableError();
  }

  return key;
}

export function requireStripeWebhookSecret(): string {
  const secret = stripeWebhookSecret();

  if (!secret) {
    throw billingUnavailableError();
  }

  return secret;
}
