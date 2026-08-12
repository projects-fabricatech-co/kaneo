import type Stripe from "stripe";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  mapSubscription,
  readCurrentPeriodEnd,
  readInvoiceSubscriptionId,
  readPriceId,
} from "../../../apps/fidelidade-api/src/billing/subscription-fields";

const PERIOD_END = 1_800_000_000;

/**
 * Shaped like a subscription rendered by a CURRENT API version: the period
 * bounds live on the item, and there is nothing at the root.
 */
function currentShapedSubscription(
  overrides: Record<string, unknown> = {},
  itemOverrides: Record<string, unknown> = {},
): Stripe.Subscription {
  return {
    id: "sub_current",
    object: "subscription",
    customer: "cus_123",
    status: "active",
    cancel_at_period_end: false,
    canceled_at: null,
    trial_end: null,
    metadata: { ownerUserId: "user_1" },
    items: {
      object: "list",
      data: [
        {
          id: "si_1",
          object: "subscription_item",
          current_period_start: PERIOD_END - 2_592_000,
          current_period_end: PERIOD_END,
          price: { id: "price_pro_mensal", object: "price" },
          ...itemOverrides,
        },
      ],
    },
    ...overrides,
  } as unknown as Stripe.Subscription;
}

/** Shaped like an OLD payload: period end at the root, none on the item. */
function legacyShapedSubscription(): Stripe.Subscription {
  return {
    id: "sub_legacy",
    object: "subscription",
    customer: "cus_123",
    status: "active",
    cancel_at_period_end: false,
    canceled_at: null,
    trial_end: null,
    current_period_end: PERIOD_END,
    metadata: {},
    items: {
      object: "list",
      data: [
        {
          id: "si_1",
          object: "subscription_item",
          price: { id: "price_pro_mensal", object: "price" },
        },
      ],
    },
  } as unknown as Stripe.Subscription;
}

describe("reading a Stripe subscription", () => {
  beforeEach(() => {
    vi.stubEnv("STRIPE_PRICE_ESSENCIAL_MONTHLY", "price_essencial_mensal");
    vi.stubEnv("STRIPE_PRICE_ESSENCIAL_ANNUAL", "price_essencial_anual");
    vi.stubEnv("STRIPE_PRICE_PRO_MONTHLY", "price_pro_mensal");
    vi.stubEnv("STRIPE_PRICE_PRO_ANNUAL", "price_pro_anual");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("reads current_period_end off the subscription ITEM", () => {
    const subscription = currentShapedSubscription();

    // The root really is empty on this shape — that is the trap being guarded.
    expect(
      (subscription as unknown as { current_period_end?: unknown })
        .current_period_end,
    ).toBeUndefined();

    expect(readCurrentPeriodEnd(subscription)).toEqual(
      new Date(PERIOD_END * 1000),
    );
  });

  it("still reads it off the root for an older payload", () => {
    expect(readCurrentPeriodEnd(legacyShapedSubscription())).toEqual(
      new Date(PERIOD_END * 1000),
    );
  });

  it("returns null when neither place has it", () => {
    const subscription = currentShapedSubscription(
      {},
      {
        current_period_end: null,
      },
    );

    expect(readCurrentPeriodEnd(subscription)).toBeNull();
  });

  it("reads the price id off the first item", () => {
    expect(readPriceId(currentShapedSubscription())).toBe("price_pro_mensal");
  });

  it("maps a configured price onto its plan and interval", () => {
    const mapped = mapSubscription(currentShapedSubscription());

    expect(mapped.plan).toBe("pro");
    expect(mapped.billingInterval).toBe("monthly");
    expect(mapped.stripeCustomerId).toBe("cus_123");
    expect(mapped.ownerUserIdFromMetadata).toBe("user_1");
    expect(mapped.currentPeriodEnd).toEqual(new Date(PERIOD_END * 1000));
  });

  it("refuses to grant a plan for a price that is not configured", () => {
    const mapped = mapSubscription(
      currentShapedSubscription(
        {},
        {
          price: { id: "price_de_outro_produto", object: "price" },
        },
      ),
    );

    expect(mapped.plan).toBe("gratis");
    expect(mapped.billingInterval).toBeNull();
    // The id is still recorded, so support can see what actually arrived.
    expect(mapped.stripePriceId).toBe("price_de_outro_produto");
  });

  it("keeps trialEndsAt only while the subscription is really trialing", () => {
    const trialEnd = Math.floor(Date.now() / 1000) + 86_400;

    const trialing = mapSubscription(
      currentShapedSubscription({ status: "trialing", trial_end: trialEnd }),
    );
    expect(trialing.trialEndsAt).toEqual(new Date(trialEnd * 1000));

    // Stripe leaves `trial_end` set after the trial converts or is cancelled;
    // storing it would keep entitling the plan through `effectivePlan`.
    const canceled = mapSubscription(
      currentShapedSubscription({ status: "canceled", trial_end: trialEnd }),
    );
    expect(canceled.trialEndsAt).toBeNull();
  });

  it("finds the subscription id on both invoice shapes", () => {
    const current = {
      id: "in_1",
      object: "invoice",
      parent: { subscription_details: { subscription: "sub_current" } },
    } as unknown as Stripe.Invoice;

    const legacy = {
      id: "in_2",
      object: "invoice",
      parent: null,
      subscription: "sub_legacy",
    } as unknown as Stripe.Invoice;

    expect(readInvoiceSubscriptionId(current)).toBe("sub_current");
    expect(readInvoiceSubscriptionId(legacy)).toBe("sub_legacy");
    expect(
      readInvoiceSubscriptionId({
        id: "in_3",
        object: "invoice",
        parent: null,
      } as unknown as Stripe.Invoice),
    ).toBeNull();
  });
});
