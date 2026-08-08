import { eq } from "drizzle-orm";
import db, { schema } from "../database";
import type { DatabaseExecutor } from "../database/executor";
import { isPlanId, PLAN_LIMITS, type PlanId, type PlanLimits } from "./limits";

type SubscriptionRow = typeof schema.subscriptionTable.$inferSelect;

/** Stripe statuses that still entitle the owner to the paid plan. */
const ENTITLING_STATUSES = new Set(["active", "trialing", "past_due"]);

/**
 * PURE. No subscription row, an unknown plan, or a lapsed status all resolve to
 * "gratis" — a lapsed subscription downgrades rather than locking the account.
 */
export function effectivePlan(
  sub: Pick<SubscriptionRow, "plan" | "status" | "trialEndsAt"> | null,
): PlanId {
  if (!sub) {
    return "gratis";
  }

  if (!isPlanId(sub.plan)) {
    return "gratis";
  }

  if (sub.trialEndsAt && sub.trialEndsAt.getTime() > Date.now()) {
    return sub.plan;
  }

  if (ENTITLING_STATUSES.has(sub.status)) {
    return sub.plan;
  }

  return "gratis";
}

export type ResolvedPlan = {
  plan: PlanId;
  limits: PlanLimits;
};

/**
 * Deliberately NOT gated on whether Stripe keys are configured: limits must
 * behave identically before and after billing goes live, otherwise the first
 * deploy with keys silently changes every existing account's behaviour.
 */
function devForcedPlan(): PlanId | null {
  if (process.env.NODE_ENV === "production") {
    return null;
  }

  const forced = process.env.FIDELIDADE_DEV_FORCE_PLAN?.trim();

  return isPlanId(forced) ? forced : null;
}

function toResolvedPlan(plan: PlanId): ResolvedPlan {
  return { plan, limits: PLAN_LIMITS[plan] };
}

export async function resolvePlanForUser(
  userId: string,
  tx: DatabaseExecutor = db,
): Promise<ResolvedPlan> {
  const forced = devForcedPlan();
  if (forced) {
    return toResolvedPlan(forced);
  }

  const [sub] = await tx
    .select({
      plan: schema.subscriptionTable.plan,
      status: schema.subscriptionTable.status,
      trialEndsAt: schema.subscriptionTable.trialEndsAt,
    })
    .from(schema.subscriptionTable)
    .where(eq(schema.subscriptionTable.ownerUserId, userId))
    .limit(1);

  return toResolvedPlan(effectivePlan(sub ?? null));
}

/**
 * The ONLY place that walks storeId -> stores.ownerUserId -> subscription. Every
 * store-scoped limit check goes through here, so no call site can drift into its
 * own (wrong) resolution.
 */
export async function resolvePlanForStore(
  storeId: string,
  tx: DatabaseExecutor = db,
): Promise<ResolvedPlan> {
  const forced = devForcedPlan();
  if (forced) {
    return toResolvedPlan(forced);
  }

  const [store] = await tx
    .select({ ownerUserId: schema.storeTable.ownerUserId })
    .from(schema.storeTable)
    .where(eq(schema.storeTable.id, storeId))
    .limit(1);

  if (!store) {
    return toResolvedPlan("gratis");
  }

  return resolvePlanForUser(store.ownerUserId, tx);
}
