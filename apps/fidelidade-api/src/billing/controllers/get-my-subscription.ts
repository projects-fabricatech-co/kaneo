import { and, count, eq, isNull } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import db from "../../database";
import {
  customerTable,
  storeMemberTable,
  storeTable,
  subscriptionTable,
} from "../../database/schema";
import { PLAN_LABELS, type PlanLimits } from "../../plans/limits";
import { resolvePlanForUser } from "../../plans/resolve-plan";
import { type BillingInterval, isBillingConfigured } from "../config";

export type SubscriptionUsage = {
  /** The store the customer/member counts below are about, if the owner has one. */
  storeId: string | null;
  stores: number;
  customers: number;
  members: number;
};

export type MySubscription = {
  plan: string;
  planLabel: string;
  limits: PlanLimits;
  usage: SubscriptionUsage;
  status: string | null;
  billingInterval: BillingInterval | string | null;
  currentPeriodEnd: Date | null;
  cancelAtPeriodEnd: boolean;
  trialEndsAt: Date | null;
  /** Whether the Billing Portal endpoint has a Stripe customer to open. */
  hasStripeCustomer: boolean;
  /** False when the deploy has no Stripe keys: the /planos screen hides the CTAs. */
  billingConfigured: boolean;
};

/**
 * The store whose usage the /planos screen shows. An explicit `storeId` is
 * checked for membership and answers 404 when it is somebody else's — the same
 * answer a store that does not exist gets, so the endpoint cannot be used to
 * probe for ids.
 */
async function resolveActiveStoreId(
  userId: string,
  requestedStoreId?: string,
): Promise<string | null> {
  if (requestedStoreId) {
    const [member] = await db
      .select({ storeId: storeMemberTable.storeId })
      .from(storeMemberTable)
      .where(
        and(
          eq(storeMemberTable.storeId, requestedStoreId),
          eq(storeMemberTable.userId, userId),
        ),
      )
      .limit(1);

    if (!member) {
      throw new HTTPException(404, { message: "Loja não encontrada" });
    }

    return member.storeId;
  }

  const [first] = await db
    .select({ id: storeTable.id })
    .from(storeTable)
    .where(
      and(eq(storeTable.ownerUserId, userId), isNull(storeTable.archivedAt)),
    )
    .orderBy(storeTable.createdAt)
    .limit(1);

  return first?.id ?? null;
}

async function countStores(userId: string): Promise<number> {
  const [row] = await db
    .select({ value: count() })
    .from(storeTable)
    .where(
      and(eq(storeTable.ownerUserId, userId), isNull(storeTable.archivedAt)),
    );

  return Number(row?.value ?? 0);
}

async function countCustomers(storeId: string): Promise<number> {
  const [row] = await db
    .select({ value: count() })
    .from(customerTable)
    .where(
      and(eq(customerTable.storeId, storeId), isNull(customerTable.archivedAt)),
    );

  return Number(row?.value ?? 0);
}

async function countMembers(storeId: string): Promise<number> {
  const [row] = await db
    .select({ value: count() })
    .from(storeMemberTable)
    .where(eq(storeMemberTable.storeId, storeId));

  return Number(row?.value ?? 0);
}

async function getMySubscription(
  userId: string,
  requestedStoreId?: string,
): Promise<MySubscription> {
  const [subscription] = await db
    .select({
      status: subscriptionTable.status,
      billingInterval: subscriptionTable.billingInterval,
      currentPeriodEnd: subscriptionTable.currentPeriodEnd,
      cancelAtPeriodEnd: subscriptionTable.cancelAtPeriodEnd,
      trialEndsAt: subscriptionTable.trialEndsAt,
      stripeCustomerId: subscriptionTable.stripeCustomerId,
    })
    .from(subscriptionTable)
    .where(eq(subscriptionTable.ownerUserId, userId))
    .limit(1);

  // The plan comes from `resolvePlanForUser`, never from `subscriptions.plan`:
  // that column records what was bought, and only `effectivePlan` knows whether
  // the status still entitles it.
  const { plan, limits } = await resolvePlanForUser(userId);

  const storeId = await resolveActiveStoreId(userId, requestedStoreId);

  const [stores, customers, members] = await Promise.all([
    countStores(userId),
    storeId ? countCustomers(storeId) : Promise.resolve(0),
    storeId ? countMembers(storeId) : Promise.resolve(0),
  ]);

  return {
    plan,
    planLabel: PLAN_LABELS[plan],
    limits,
    usage: { storeId, stores, customers, members },
    status: subscription?.status ?? null,
    billingInterval: subscription?.billingInterval ?? null,
    currentPeriodEnd: subscription?.currentPeriodEnd ?? null,
    cancelAtPeriodEnd: subscription?.cancelAtPeriodEnd ?? false,
    trialEndsAt: subscription?.trialEndsAt ?? null,
    // The ids themselves stay on the server. The client never needs
    // `cus_...`/`sub_...` — POST /billing/portal is how it reaches Stripe — and
    // anything shipped to the browser is one screenshot away from a support
    // channel.
    hasStripeCustomer: Boolean(subscription?.stripeCustomerId),
    billingConfigured: isBillingConfigured(),
  };
}

export default getMySubscription;
