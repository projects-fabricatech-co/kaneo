import { and, eq, gte, isNull, sql } from "drizzle-orm";
import {
  type BillingInterval,
  monthlyRevenueCents,
  PAID_PLAN_IDS,
  type PaidPlanId,
} from "../../billing/config";
import db from "../../database";
import {
  customerTable,
  stampTable,
  storeTable,
  subscriptionTable,
  userTable,
} from "../../database/schema";
import { PLAN_IDS, type PlanId } from "../../plans/limits";

/**
 * The clock the platform-wide numbers are bucketed in.
 *
 * The lojista's painel buckets by each store's own `timezone`, which is right
 * for a shop and impossible for a total: summing counts taken in different
 * timezones would double-count the hours where they disagree. So the platform
 * picks ONE clock and the screen says which — a "hoje" with an unstated clock is
 * a number that misleads.
 */
export const PLATFORM_TIMEZONE = "America/Sao_Paulo";

/** Stripe statuses that are actually paying right now. */
const PAYING_STATUS = "active";

export type PlanBreakdownRow = {
  plan: PlanId;
  status: string;
  count: number;
};

export type PlatformMetrics = {
  timezone: string;
  accounts: number;
  stores: number;
  customers: number;
  stampsToday: number;
  stampsWeek: number;
  stampsMonth: number;
  /** Nominal MRR in centavos. See the caveat below. */
  mrrCents: number;
  payingAccounts: number;
  trialingAccounts: number;
  pastDueAccounts: number;
  /** Paying accounts over all accounts, 0–1. */
  paidConversion: number;
  /** Cancellations in the last 30 days over paying + cancelled, 0–1. */
  churn30d: number;
  planBreakdown: PlanBreakdownRow[];
};

const countAll = sql<number>`count(*)::int`;

const localToday = sql`date_trunc('day', now() at time zone ${PLATFORM_TIMEZONE})`;

const stampLocalTime = sql`${stampTable.createdAt} at time zone ${PLATFORM_TIMEZONE}`;

function localDaysAgo(days: number) {
  return sql`${localToday} - make_interval(days => ${days}::int)`;
}

function isPaidPlan(plan: string): plan is PaidPlanId {
  return (PAID_PLAN_IDS as readonly string[]).includes(plan);
}

function isBillingInterval(value: string | null): value is BillingInterval {
  return value === "monthly" || value === "annual";
}

function isKnownPlan(plan: string): plan is PlanId {
  return (PLAN_IDS as readonly string[]).includes(plan);
}

/**
 * Nominal monthly recurring revenue, in centavos.
 *
 * Grouped in Postgres down to at most six rows — three plans by two intervals —
 * and multiplied in JavaScript, because the amount lives in `billing/config.ts`
 * and dragging that table into SQL would be a second copy of the price list.
 *
 * NOMINAL is the word that matters. This is list price times headcount. A
 * discount, a coupon or a tax applied inside Stripe is invisible here, so the
 * number can differ from Stripe's own dashboard; reconciling the two is phase D.
 *
 * `trialing` and `past_due` are excluded and counted separately: a trial has not
 * paid and a past-due account has stopped paying, and folding either into MRR
 * turns the one number you would act on into the one number you cannot trust.
 * A row whose plan or interval we do not recognise is skipped for the same
 * reason `resolvePrice` refuses an unknown Stripe price.
 */
async function sumMrrCents(): Promise<number> {
  const rows = await db
    .select({
      plan: subscriptionTable.plan,
      interval: subscriptionTable.billingInterval,
      count: countAll,
    })
    .from(subscriptionTable)
    .where(eq(subscriptionTable.status, PAYING_STATUS))
    .groupBy(subscriptionTable.plan, subscriptionTable.billingInterval);

  let total = 0;

  for (const row of rows) {
    if (!isPaidPlan(row.plan) || !isBillingInterval(row.interval)) {
      continue;
    }

    total += monthlyRevenueCents(row.plan, row.interval) * row.count;
  }

  return total;
}

async function getPlanBreakdown(): Promise<PlanBreakdownRow[]> {
  const rows = await db
    .select({
      plan: subscriptionTable.plan,
      status: subscriptionTable.status,
      count: countAll,
    })
    .from(subscriptionTable)
    .groupBy(subscriptionTable.plan, subscriptionTable.status)
    .orderBy(subscriptionTable.plan, subscriptionTable.status);

  return rows
    .filter((row): row is PlanBreakdownRow & { plan: PlanId } =>
      isKnownPlan(row.plan),
    )
    .map((row) => ({ plan: row.plan, status: row.status, count: row.count }));
}

/**
 * Everything the console's first screen shows, in two round trips plus the
 * breakdown — the counters in one aggregate query, then the two grouped ones.
 *
 * The counters are scalar subqueries in a single statement for the same reason
 * the lojista's painel does it: the response is a fixed handful of integers
 * whether the platform has three shops or thirty thousand.
 */
async function getPlatformMetrics(): Promise<PlatformMetrics> {
  const accounts = db.select({ value: countAll }).from(userTable);

  const stores = db
    .select({ value: countAll })
    .from(storeTable)
    .where(isNull(storeTable.archivedAt));

  const customers = db
    .select({ value: countAll })
    .from(customerTable)
    .where(isNull(customerTable.archivedAt));

  const liveStamps = isNull(stampTable.voidedAt);

  const stampsToday = db
    .select({ value: countAll })
    .from(stampTable)
    .where(
      and(liveStamps, sql`date_trunc('day', ${stampLocalTime}) = ${localToday}`),
    );

  const stampsWeek = db
    .select({ value: countAll })
    .from(stampTable)
    .where(and(liveStamps, gte(stampLocalTime, localDaysAgo(6))));

  const stampsMonth = db
    .select({ value: countAll })
    .from(stampTable)
    .where(and(liveStamps, gte(stampLocalTime, localDaysAgo(29))));

  const payingAccounts = db
    .select({ value: countAll })
    .from(subscriptionTable)
    .where(eq(subscriptionTable.status, PAYING_STATUS));

  const trialingAccounts = db
    .select({ value: countAll })
    .from(subscriptionTable)
    .where(eq(subscriptionTable.status, "trialing"));

  const pastDueAccounts = db
    .select({ value: countAll })
    .from(subscriptionTable)
    .where(eq(subscriptionTable.status, "past_due"));

  // Cancellations in the trailing 30 days. `canceled_at` and not the status,
  // because a row that cancelled and then resubscribed still happened.
  const canceled30d = db
    .select({ value: countAll })
    .from(subscriptionTable)
    .where(
      and(
        sql`${subscriptionTable.canceledAt} is not null`,
        gte(subscriptionTable.canceledAt, sql`now() - interval '30 days'`),
      ),
    );

  const [counters] = await db
    .select({
      accounts: sql<number>`(${accounts})`,
      stores: sql<number>`(${stores})`,
      customers: sql<number>`(${customers})`,
      stampsToday: sql<number>`(${stampsToday})`,
      stampsWeek: sql<number>`(${stampsWeek})`,
      stampsMonth: sql<number>`(${stampsMonth})`,
      payingAccounts: sql<number>`(${payingAccounts})`,
      trialingAccounts: sql<number>`(${trialingAccounts})`,
      pastDueAccounts: sql<number>`(${pastDueAccounts})`,
      canceled30d: sql<number>`(${canceled30d})`,
    })
    .from(sql`(select 1) as one`);

  const [mrrCents, planBreakdown] = await Promise.all([
    sumMrrCents(),
    getPlanBreakdown(),
  ]);

  // Guarded division in both ratios: a platform with no accounts yet must render
  // 0%, not NaN. A blank tile reads as a broken screen, and on day one the
  // screen is not broken — it is empty.
  const denominator = counters?.accounts ?? 0;
  const churnBase = (counters?.payingAccounts ?? 0) + (counters?.canceled30d ?? 0);

  return {
    timezone: PLATFORM_TIMEZONE,
    accounts: counters?.accounts ?? 0,
    stores: counters?.stores ?? 0,
    customers: counters?.customers ?? 0,
    stampsToday: counters?.stampsToday ?? 0,
    stampsWeek: counters?.stampsWeek ?? 0,
    stampsMonth: counters?.stampsMonth ?? 0,
    mrrCents,
    payingAccounts: counters?.payingAccounts ?? 0,
    trialingAccounts: counters?.trialingAccounts ?? 0,
    pastDueAccounts: counters?.pastDueAccounts ?? 0,
    paidConversion:
      denominator > 0 ? (counters?.payingAccounts ?? 0) / denominator : 0,
    churn30d: churnBase > 0 ? (counters?.canceled30d ?? 0) / churnBase : 0,
    planBreakdown,
  };
}

export default getPlatformMetrics;
