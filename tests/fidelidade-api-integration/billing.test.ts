import { eq } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// The Stripe SDK never runs in this suite: no keys, no network. Everything above
// the SDK — the owner check, the customer reuse, the insert-and-claim, the
// mapping onto `subscriptions` — is the real code.
vi.mock(
  "../../apps/fidelidade-api/src/billing/stripe-client",
  async () => import("./mocks/stripe-client"),
);

import db, { schema } from "../../apps/fidelidade-api/src/database";
import { createApp } from "../../apps/fidelidade-api/src/index";
import { mockAuthenticatedSession } from "./helpers/auth";
import { resetTestDatabase } from "./helpers/database";
import {
  createCard,
  createCustomer,
  createProgram,
  createStoreCashier,
  createStoreOwner,
  grantPlan,
} from "./helpers/fixtures";
import { resetStripeMock, stripeCalls } from "./mocks/stripe-client";

const PRICE_PRO_MONTHLY = "price_pro_monthly_mock";
const PRICE_ESSENCIAL_MONTHLY = "price_essencial_monthly_mock";
const PERIOD_END_SECONDS = 1_800_000_000;
const PERIOD_END = new Date(PERIOD_END_SECONDS * 1000);

type SubscriptionEventOptions = {
  eventId: string;
  type?: string;
  subscriptionId?: string;
  customerId?: string;
  ownerUserId?: string | null;
  priceId?: string;
  status?: string;
  periodEnd?: number | null;
  cancelAtPeriodEnd?: boolean;
  trialEnd?: number | null;
};

/**
 * A `customer.subscription.*` payload shaped the way a CURRENT API version
 * renders one: `current_period_end` lives on the ITEM and there is nothing at
 * the subscription root.
 */
function subscriptionEvent(options: SubscriptionEventOptions) {
  const {
    eventId,
    type = "customer.subscription.created",
    subscriptionId = "sub_test_1",
    customerId = "cus_test_1",
    ownerUserId = null,
    priceId = PRICE_PRO_MONTHLY,
    status = "active",
    periodEnd = PERIOD_END_SECONDS,
    cancelAtPeriodEnd = false,
    trialEnd = null,
  } = options;

  return {
    id: eventId,
    object: "event",
    type,
    api_version: "2026-07-29.dahlia",
    data: {
      object: {
        id: subscriptionId,
        object: "subscription",
        customer: customerId,
        status,
        cancel_at_period_end: cancelAtPeriodEnd,
        canceled_at: null,
        trial_end: trialEnd,
        metadata: ownerUserId ? { ownerUserId } : {},
        items: {
          object: "list",
          data: [
            {
              id: "si_test_1",
              object: "subscription_item",
              current_period_end: periodEnd,
              price: { id: priceId, object: "price" },
            },
          ],
        },
      },
    },
  };
}

function invoiceEvent(options: {
  eventId: string;
  type: "invoice.paid" | "invoice.payment_failed";
  subscriptionId?: string;
}) {
  return {
    id: options.eventId,
    object: "event",
    type: options.type,
    data: {
      object: {
        id: `in_${options.eventId}`,
        object: "invoice",
        parent: {
          subscription_details: {
            subscription: options.subscriptionId ?? "sub_test_1",
          },
        },
      },
    },
  };
}

type App = ReturnType<typeof createApp>["app"];

function deliver(
  app: App,
  event: unknown,
  signature: string | null = "t=1,v1=x",
) {
  return app.request("/api/stripe/webhook", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(signature ? { "stripe-signature": signature } : {}),
    },
    body: JSON.stringify(event),
  });
}

function readSubscription(ownerUserId: string) {
  return db
    .select()
    .from(schema.subscriptionTable)
    .where(eq(schema.subscriptionTable.ownerUserId, ownerUserId))
    .limit(1)
    .then((rows) => rows[0]);
}

describe("API integration: billing", () => {
  beforeEach(async () => {
    await resetTestDatabase();
    resetStripeMock();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  // ───────────────────────────────────────────────────────────────────────────
  // Webhook
  // ───────────────────────────────────────────────────────────────────────────

  it("grants the plan and stores the period end read off the subscription item", async () => {
    const { user } = await createStoreOwner();
    const { app } = createApp();

    const response = await deliver(
      app,
      subscriptionEvent({ eventId: "evt_1", ownerUserId: user.id }),
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ outcome: "processed" });

    const row = await readSubscription(user.id);
    expect(row).toMatchObject({
      plan: "pro",
      status: "active",
      billingInterval: "monthly",
      stripeSubscriptionId: "sub_test_1",
      stripeCustomerId: "cus_test_1",
      stripePriceId: PRICE_PRO_MONTHLY,
      cancelAtPeriodEnd: false,
    });
    // Would be null if the handler read `current_period_end` off the root.
    expect(row?.currentPeriodEnd).toEqual(PERIOD_END);
  });

  it("applies a replayed event exactly once", async () => {
    const { user } = await createStoreOwner();
    const { app } = createApp();

    const first = await deliver(
      app,
      subscriptionEvent({ eventId: "evt_replay", ownerUserId: user.id }),
    );
    expect(first.status).toBe(200);

    const afterFirst = await readSubscription(user.id);

    // Same event id, DIFFERENT contents: if the claim were a no-op the row would
    // move to Essencial. Asserting on the row, not just on the status code, is
    // the only way to see that nothing was re-applied.
    const second = await deliver(
      app,
      subscriptionEvent({
        eventId: "evt_replay",
        ownerUserId: user.id,
        priceId: PRICE_ESSENCIAL_MONTHLY,
        status: "past_due",
      }),
    );

    expect(second.status).toBe(200);
    expect(await second.json()).toMatchObject({ outcome: "duplicate" });

    const afterSecond = await readSubscription(user.id);
    expect(afterSecond?.plan).toBe("pro");
    expect(afterSecond?.status).toBe("active");
    expect(afterSecond?.stripePriceId).toBe(PRICE_PRO_MONTHLY);
    expect(afterSecond?.updatedAt).toEqual(afterFirst?.updatedAt);

    const events = await db.select().from(schema.stripeEventTable);
    expect(events).toHaveLength(1);
  });

  it("downgrades a deleted subscription to Grátis without touching the shop's data", async () => {
    const { user, store } = await createStoreOwner();
    const program = await createProgram(store.id);
    const customer = await createCustomer(store.id);
    await createCard(store.id, program.id, customer.id);

    const { app } = createApp();

    await deliver(
      app,
      subscriptionEvent({ eventId: "evt_up", ownerUserId: user.id }),
    );

    const deleted = await deliver(
      app,
      subscriptionEvent({
        eventId: "evt_down",
        type: "customer.subscription.deleted",
        ownerUserId: user.id,
        status: "canceled",
      }),
    );
    expect(deleted.status).toBe(200);

    const row = await readSubscription(user.id);
    // The plan column still records what was bought; the STATUS is what lapses,
    // and `effectivePlan` is what turns the pair into Grátis.
    expect(row?.plan).toBe("pro");
    expect(row?.status).toBe("canceled");
    expect(row?.trialEndsAt).toBeNull();

    mockAuthenticatedSession(user);

    const billing = await app.request("/api/billing");
    expect(billing.status).toBe(200);
    expect(await billing.json()).toMatchObject({ plan: "gratis" });

    // Existing data stays READABLE. A lapsed plan is a downgrade, not a lock.
    const customers = await app.request(
      `/api/customer?storeId=${store.id}&limit=10`,
    );
    expect(customers.status).toBe(200);
    const customersBody = (await customers.json()) as { items: unknown[] };
    expect(customersBody.items).toHaveLength(1);

    const cards = await app.request(`/api/card?storeId=${store.id}`);
    expect(cards.status).toBe(200);
    expect((await cards.json()) as unknown[]).toHaveLength(1);

    const stores = await app.request("/api/store");
    expect(stores.status).toBe(200);
    expect((await stores.json()) as unknown[]).toHaveLength(1);

    // Only CREATING something new is refused.
    const secondStore = await app.request("/api/store", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: "Segunda Loja", slug: "segunda-loja" }),
    });
    expect(secondStore.status).toBe(402);
  });

  it("keeps entitling a past_due subscription but not a canceled one", async () => {
    const { user } = await createStoreOwner();
    const { app } = createApp();
    mockAuthenticatedSession(user);

    await deliver(
      app,
      subscriptionEvent({
        eventId: "evt_pastdue",
        ownerUserId: user.id,
        status: "past_due",
      }),
    );

    const duringDunning = await app.request("/api/billing");
    expect(await duringDunning.json()).toMatchObject({
      plan: "pro",
      status: "past_due",
    });

    await deliver(
      app,
      subscriptionEvent({
        eventId: "evt_canceled",
        type: "customer.subscription.updated",
        ownerUserId: user.id,
        status: "canceled",
      }),
    );

    const afterCancel = await app.request("/api/billing");
    expect(await afterCancel.json()).toMatchObject({
      plan: "gratis",
      status: "canceled",
    });
  });

  it("does NOT grant a plan for a price id that is not in the configured map", async () => {
    const { user } = await createStoreOwner();
    const { app } = createApp();

    const response = await deliver(
      app,
      subscriptionEvent({
        eventId: "evt_unknown_price",
        ownerUserId: user.id,
        priceId: "price_de_outro_produto",
      }),
    );
    expect(response.status).toBe(200);

    const row = await readSubscription(user.id);
    expect(row?.plan).toBe("gratis");
    expect(row?.billingInterval).toBeNull();
    expect(row?.stripePriceId).toBe("price_de_outro_produto");

    mockAuthenticatedSession(user);
    const billing = await app.request("/api/billing");
    expect(await billing.json()).toMatchObject({ plan: "gratis" });
  });

  it("answers 200 to an event type it has no opinion about", async () => {
    const { user } = await createStoreOwner();
    const { app } = createApp();

    const response = await deliver(app, {
      id: "evt_unknown_type",
      object: "event",
      type: "radar.early_fraud_warning.created",
      data: { object: { id: "issfr_1", object: "radar.early_fraud_warning" } },
    });

    // 500 here would put Stripe into a retry loop that can never succeed.
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ outcome: "ignored" });
    expect(await readSubscription(user.id)).toBeUndefined();
  });

  it("rejects a delivery with no signature header", async () => {
    const { app } = createApp();

    const response = await deliver(
      app,
      subscriptionEvent({ eventId: "evt_unsigned" }),
      null,
    );

    expect(response.status).toBe(400);
    expect(await response.text()).toMatch(/Assinatura/);
    expect(await db.select().from(schema.stripeEventTable)).toHaveLength(0);
  });

  it("ignores a subscription it cannot attribute to an account", async () => {
    const { app } = createApp();

    const response = await deliver(
      app,
      subscriptionEvent({
        eventId: "evt_orphan",
        ownerUserId: "user_que_nao_existe",
      }),
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ outcome: "ignored" });
    expect(await db.select().from(schema.subscriptionTable)).toHaveLength(0);
  });

  it("links the Stripe customer on checkout.session.completed without granting a plan", async () => {
    const { user } = await createStoreOwner();
    const { app } = createApp();

    const response = await deliver(app, {
      id: "evt_checkout",
      object: "event",
      type: "checkout.session.completed",
      data: {
        object: {
          id: "cs_test_1",
          object: "checkout.session",
          mode: "subscription",
          customer: "cus_checkout_1",
          subscription: "sub_test_1",
          client_reference_id: user.id,
          metadata: { ownerUserId: user.id },
        },
      },
    });

    expect(response.status).toBe(200);

    const row = await readSubscription(user.id);
    expect(row?.stripeCustomerId).toBe("cus_checkout_1");
    // The session carries no price, so nothing is granted here — the
    // `customer.subscription.created` that follows is what does it.
    expect(row?.plan).toBe("gratis");
  });

  it("moves the row to past_due on a failed charge and back on the next paid invoice", async () => {
    const { user } = await createStoreOwner();
    const { app } = createApp();

    await deliver(
      app,
      subscriptionEvent({ eventId: "evt_active", ownerUserId: user.id }),
    );

    await deliver(
      app,
      invoiceEvent({ eventId: "evt_failed", type: "invoice.payment_failed" }),
    );
    expect((await readSubscription(user.id))?.status).toBe("past_due");

    await deliver(
      app,
      invoiceEvent({ eventId: "evt_paid", type: "invoice.paid" }),
    );
    expect((await readSubscription(user.id))?.status).toBe("active");
  });

  it("will not let a late invoice resurrect a cancelled subscription", async () => {
    const { user } = await createStoreOwner();
    const { app } = createApp();

    await deliver(
      app,
      subscriptionEvent({ eventId: "evt_a", ownerUserId: user.id }),
    );
    await deliver(
      app,
      subscriptionEvent({
        eventId: "evt_b",
        type: "customer.subscription.deleted",
        ownerUserId: user.id,
        status: "canceled",
      }),
    );

    await deliver(
      app,
      invoiceEvent({ eventId: "evt_late", type: "invoice.paid" }),
    );

    expect((await readSubscription(user.id))?.status).toBe("canceled");
  });

  // ───────────────────────────────────────────────────────────────────────────
  // Checkout and portal
  // ───────────────────────────────────────────────────────────────────────────

  it("opens a checkout for the owner with the mapped price and the owner id attached", async () => {
    const { user } = await createStoreOwner();
    mockAuthenticatedSession(user);
    const { app } = createApp();

    const response = await app.request("/api/billing/checkout", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ plan: "pro", interval: "monthly" }),
    });

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      checkoutUrl: "https://checkout.stripe.test/session_mock",
    });

    expect(stripeCalls.checkouts).toHaveLength(1);
    const checkout = stripeCalls.checkouts[0];
    expect(checkout?.priceId).toBe(PRICE_PRO_MONTHLY);
    expect(checkout?.ownerUserId).toBe(user.id);
    expect(checkout?.successUrl).toContain("http://localhost:5174/planos");
    // Stripe substitutes this placeholder; URL-encoding it would break it.
    expect(checkout?.successUrl).toContain("{CHECKOUT_SESSION_ID}");
    expect(checkout?.cancelUrl).toBe(
      "http://localhost:5174/planos?checkout=cancelado",
    );

    // The customer was created once and remembered.
    expect(stripeCalls.customers).toHaveLength(1);
    expect((await readSubscription(user.id))?.stripeCustomerId).toBe(
      "cus_mock_1",
    );
  });

  it("reuses the owner's existing Stripe customer instead of creating a second one", async () => {
    const { user } = await createStoreOwner();
    await grantPlan(user.id, "essencial", {
      stripeCustomerId: "cus_ja_existente",
    });
    mockAuthenticatedSession(user);
    const { app } = createApp();

    const response = await app.request("/api/billing/checkout", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ plan: "pro", interval: "annual" }),
    });

    expect(response.status).toBe(200);
    expect(stripeCalls.customers).toHaveLength(0);
    expect(stripeCalls.checkouts[0]?.customerId).toBe("cus_ja_existente");
    expect(stripeCalls.checkouts[0]?.priceId).toBe("price_pro_annual_mock");
  });

  it("refuses checkout and portal to a cashier", async () => {
    const { store } = await createStoreOwner();
    const cashier = await createStoreCashier(store.id);
    mockAuthenticatedSession(cashier);
    const { app } = createApp();

    const checkout = await app.request("/api/billing/checkout", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ plan: "pro", interval: "monthly" }),
    });
    expect(checkout.status).toBe(403);
    expect(await checkout.text()).toMatch(/propriet/i);

    const portal = await app.request("/api/billing/portal", { method: "POST" });
    expect(portal.status).toBe(403);

    const summary = await app.request("/api/billing");
    expect(summary.status).toBe(403);

    expect(stripeCalls.checkouts).toHaveLength(0);
    expect(stripeCalls.portals).toHaveLength(0);
  });

  it("opens the portal for an owner who has a customer, and refuses one who does not", async () => {
    const { user } = await createStoreOwner();
    mockAuthenticatedSession(user);
    const { app } = createApp();

    const withoutCustomer = await app.request("/api/billing/portal", {
      method: "POST",
    });
    expect(withoutCustomer.status).toBe(400);
    expect(await withoutCustomer.text()).toMatch(/assinatura/i);

    await grantPlan(user.id, "pro", { stripeCustomerId: "cus_portal_1" });

    const withCustomer = await app.request("/api/billing/portal", {
      method: "POST",
    });
    expect(withCustomer.status).toBe(200);
    expect(await withCustomer.json()).toMatchObject({
      portalUrl: "https://billing.stripe.test/portal_mock",
    });
    expect(stripeCalls.portals[0]).toMatchObject({
      customerId: "cus_portal_1",
      returnUrl: "http://localhost:5174/planos",
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // The /planos read model
  // ───────────────────────────────────────────────────────────────────────────

  it("reports the plan, its limits and the current usage, and no Stripe ids", async () => {
    const { user, store } = await createStoreOwner();
    await createCustomer(store.id);
    await createCustomer(store.id);
    await createStoreCashier(store.id);
    await grantPlan(user.id, "pro", {
      stripeCustomerId: "cus_secreto",
      stripeSubscriptionId: "sub_secreto",
      stripePriceId: PRICE_PRO_MONTHLY,
      billingInterval: "monthly",
      currentPeriodEnd: PERIOD_END,
      cancelAtPeriodEnd: true,
    });

    mockAuthenticatedSession(user);
    const { app } = createApp();

    const response = await app.request("/api/billing");
    expect(response.status).toBe(200);

    const body = (await response.json()) as Record<string, unknown>;
    expect(body).toMatchObject({
      plan: "pro",
      planLabel: "Pro",
      status: "active",
      billingInterval: "monthly",
      cancelAtPeriodEnd: true,
      hasStripeCustomer: true,
      billingConfigured: true,
    });
    expect(body.currentPeriodEnd).toBe(PERIOD_END.toISOString());
    expect(body.limits).toMatchObject({ maxStores: 10, coupons: true });
    expect(body.usage).toMatchObject({
      storeId: store.id,
      stores: 1,
      customers: 2,
      members: 2,
    });

    // The portal endpoint is how the client reaches Stripe; the ids stay here.
    const serialised = JSON.stringify(body);
    expect(serialised).not.toContain("cus_secreto");
    expect(serialised).not.toContain("sub_secreto");
    expect(body).not.toHaveProperty("stripeCustomerId");
    expect(body).not.toHaveProperty("stripeSubscriptionId");
  });

  it("answers 404 for a store the caller is not a member of", async () => {
    const { user } = await createStoreOwner();
    const other = await createStoreOwner();
    mockAuthenticatedSession(user);
    const { app } = createApp();

    const response = await app.request(
      `/api/billing?storeId=${other.store.id}`,
    );
    expect(response.status).toBe(404);
  });

  it("reports Grátis with no subscription row at all", async () => {
    const { user } = await createStoreOwner();
    mockAuthenticatedSession(user);
    const { app } = createApp();

    const body = (await (await app.request("/api/billing")).json()) as Record<
      string,
      unknown
    >;

    expect(body).toMatchObject({
      plan: "gratis",
      planLabel: "Grátis",
      status: null,
      hasStripeCustomer: false,
      cancelAtPeriodEnd: false,
    });
    expect(body.limits).toMatchObject({ maxStores: 1, coupons: false });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // Billing switched off
  // ───────────────────────────────────────────────────────────────────────────

  describe("with no Stripe keys configured", () => {
    beforeEach(() => {
      vi.stubEnv("STRIPE_SECRET_KEY", "");
      vi.stubEnv("STRIPE_WEBHOOK_SECRET", "");
    });

    it("answers checkout with a clean pt-BR error instead of crashing", async () => {
      const { user } = await createStoreOwner();
      mockAuthenticatedSession(user);
      const { app } = createApp();

      const response = await app.request("/api/billing/checkout", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ plan: "pro", interval: "monthly" }),
      });

      expect(response.status).toBe(503);
      const body = (await response.json()) as Record<string, unknown>;
      expect(body.error).toBe("billing_not_configured");
      expect(body.message).toMatch(/Pagamentos/);
      expect(stripeCalls.checkouts).toHaveLength(0);
    });

    it("says so on /planos and STILL enforces the Grátis ceilings", async () => {
      const { user } = await createStoreOwner();
      mockAuthenticatedSession(user);
      const { app } = createApp();

      const summary = await app.request("/api/billing");
      expect(await summary.json()).toMatchObject({
        plan: "gratis",
        billingConfigured: false,
      });

      // Deliberately unlike Kaneo, where billing being off unlocks everything:
      // here nobody can pay, so everybody is on Grátis and the ceilings bite.
      const secondStore = await app.request("/api/store", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name: "Segunda Loja", slug: "segunda-loja" }),
      });
      expect(secondStore.status).toBe(402);
      expect(await secondStore.json()).toMatchObject({
        error: "plan_limit_exceeded",
        limit: "maxStores",
      });
    });

    it("keeps a paid plan already recorded in the database working", async () => {
      const { user } = await createStoreOwner({ plan: "pro" });
      mockAuthenticatedSession(user);
      const { app } = createApp();

      const summary = await app.request("/api/billing");
      expect(await summary.json()).toMatchObject({
        plan: "pro",
        billingConfigured: false,
      });
    });
  });
});
