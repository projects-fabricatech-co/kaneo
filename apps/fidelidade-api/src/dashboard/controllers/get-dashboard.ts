import { and, eq, gt, gte, isNull, or, type SQL, sql } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import { liveCouponWhere } from "../../coupon/coupon-window";
import db from "../../database";
import {
  cardTable,
  couponTable,
  customerTable,
  rewardTable,
  stampTable,
  storeTable,
} from "../../database/schema";

export type DashboardSummary = {
  stampsToday: number;
  stampsWeek: number;
  activeCustomers: number;
  newCustomersWeek: number;
  cardsNearGoal: number;
  pendingRewards: number;
  couponsActive: number;
};

/**
 * Midnight of the current day on the STORE's wall clock, as a naive timestamp.
 *
 * `stores.timezone` is read as a correlated column of the outer `from stores`
 * rather than passed in from JavaScript, so the boundary is whatever the shop
 * thinks midnight is — not whatever the API host's clock thinks. A padaria that
 * closes at 23:30 in São Paulo would otherwise see that last half hour of the
 * evening land on "amanhã", because 23:30 in São Paulo is already 02:30 UTC.
 */
const localToday = sql`date_trunc('day', now() at time zone ${storeTable.timezone})`;

const stampLocalTime = sql`${stampTable.createdAt} at time zone ${storeTable.timezone}`;

const customerLocalTime = sql`${customerTable.createdAt} at time zone ${storeTable.timezone}`;

/** Days back from `localToday`, as a local-calendar bound rather than an hour count. */
function localDaysAgo(days: number): SQL {
  return sql`${localToday} - make_interval(days => ${days}::int)`;
}

/**
 * `count(*)` and not `sum(...)`: over zero rows a count is 0, while a sum is
 * NULL — and a NULL tile renders as a blank square on the painel, which reads as
 * a broken screen rather than as a quiet morning.
 *
 * `::int` because `count()` is a bigint and node-postgres hands bigints back as
 * strings; the tiles would then concatenate instead of add.
 */
const countAll = sql<number>`count(*)::int`;

/**
 * The counters on the lojista's painel, in a SINGLE round trip.
 *
 * Each field is a correlated scalar subquery joined back to the outer store row
 * by `store_id = stores.id`. Scoping that way rather than by a JavaScript
 * variable means a counter physically cannot reach another shop's rows, and it
 * is also what puts `stores.timezone` in scope for the day bucketing.
 *
 * Everything is aggregated by Postgres. Nothing is summed in JavaScript, so the
 * response is seven integers whether the shop opened yesterday or has been
 * stamping for five years.
 */
async function getDashboard(storeId: string): Promise<DashboardSummary> {
  const liveStamps = and(
    eq(stampTable.storeId, storeTable.id),
    isNull(stampTable.voidedAt),
  );

  const stampsToday = db
    .select({ value: countAll })
    .from(stampTable)
    .where(
      and(
        liveStamps,
        sql`date_trunc('day', ${stampLocalTime}) = ${localToday}`,
      ),
    );

  // Seven LOCAL days ending today, so the number means "esta semana" to the
  // lojista rather than "the last 168 hours".
  const stampsWeek = db
    .select({ value: countAll })
    .from(stampTable)
    .where(and(liveStamps, gte(stampLocalTime, localDaysAgo(6))));

  const activeCustomers = db
    .select({
      value: sql<number>`count(distinct ${stampTable.customerId})::int`,
    })
    .from(stampTable)
    .where(and(liveStamps, gte(stampLocalTime, localDaysAgo(29))));

  // Archived customers are left out to match the browse list: a tile counting
  // people the list below it refuses to show reads as a bug.
  const newCustomersWeek = db
    .select({ value: countAll })
    .from(customerTable)
    .where(
      and(
        eq(customerTable.storeId, storeTable.id),
        isNull(customerTable.archivedAt),
        gte(customerLocalTime, localDaysAgo(6)),
      ),
    );

  // "Quase lá": the people worth a nudge. Measured against the card's OWN
  // `stamps_required` snapshot and not the program's current goal, because
  // raising the goal must not move the finish line for cards already in flight.
  const cardsNearGoal = db
    .select({ value: countAll })
    .from(cardTable)
    .where(
      and(
        eq(cardTable.storeId, storeTable.id),
        eq(cardTable.status, "active"),
        sql`${cardTable.stampsRequired} - ${cardTable.stampsCount} between 1 and 2`,
      ),
    );

  // Prizes the shop still owes. An expired code is not owed, and expiry is read
  // off the database clock like every other expiry in this codebase.
  const pendingRewards = db
    .select({ value: countAll })
    .from(rewardTable)
    .where(
      and(
        eq(rewardTable.storeId, storeTable.id),
        eq(rewardTable.status, "pending"),
        or(
          isNull(rewardTable.expiresAt),
          gt(rewardTable.expiresAt, sql`now()`),
        ),
      ),
    );

  // `liveCouponWhere` is the single definition of "a customer can claim this
  // right now", shared with the public landing page and the claim endpoint —
  // reused here so the painel can never disagree with what the link does.
  const couponsActive = db
    .select({ value: countAll })
    .from(couponTable)
    .where(
      and(
        eq(couponTable.storeId, storeTable.id),
        liveCouponWhere(),
        or(
          isNull(couponTable.maxRedemptions),
          sql`${couponTable.redemptionCount} < ${couponTable.maxRedemptions}`,
        ),
      ),
    );

  const [row] = await db
    .select({
      stampsToday: sql<number>`(${stampsToday})`,
      stampsWeek: sql<number>`(${stampsWeek})`,
      activeCustomers: sql<number>`(${activeCustomers})`,
      newCustomersWeek: sql<number>`(${newCustomersWeek})`,
      cardsNearGoal: sql<number>`(${cardsNearGoal})`,
      pendingRewards: sql<number>`(${pendingRewards})`,
      couponsActive: sql<number>`(${couponsActive})`,
    })
    .from(storeTable)
    .where(eq(storeTable.id, storeId))
    .limit(1);

  if (!row) {
    throw new HTTPException(404, { message: "Loja não encontrada" });
  }

  return row;
}

export default getDashboard;
