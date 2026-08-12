import { and, gt, isNull, lte, or, type SQL, sql } from "drizzle-orm";
import { couponTable } from "../database/schema";

/**
 * "Live right now": active, started, not finished. THE single definition — the
 * public landing page, the claim endpoint and the customer's card all ask the
 * same question, and a campaign that a customer can see but not claim (or the
 * reverse) is a support ticket.
 *
 * Evaluated by the database clock, like every other expiry in this codebase, so
 * an API host with a skewed clock cannot open a campaign early or keep a dead
 * one alive.
 */
export function liveCouponWhere(): SQL | undefined {
  return and(
    sql`${couponTable.status} = 'active'`,
    or(isNull(couponTable.startsAt), lte(couponTable.startsAt, sql`now()`)),
    or(isNull(couponTable.endsAt), gt(couponTable.endsAt, sql`now()`)),
  );
}

/**
 * The cap, as a rendering decision. NOT the arbiter: the only thing that decides
 * whether a claim is allowed is the guarded UPDATE in `claim-public-coupon.ts`,
 * because anything read-then-decided is a race.
 */
export function isSoldOut(coupon: {
  maxRedemptions: number | null;
  redemptionCount: number;
}): boolean {
  return (
    coupon.maxRedemptions !== null &&
    coupon.redemptionCount >= coupon.maxRedemptions
  );
}
