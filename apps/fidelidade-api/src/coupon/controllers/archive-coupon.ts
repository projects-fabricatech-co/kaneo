import { and, eq } from "drizzle-orm";
import db from "../../database";
import { couponTable } from "../../database/schema";
import { couponNotFoundError } from "./get-coupon";

/**
 * Ends the campaign. The link and the QR keep resolving, but
 * `liveCouponWhere()` no longer matches, so the landing page 404s and nothing
 * new can be claimed.
 *
 * Codes ALREADY in customers' hands stay redeemable: they were promised, and
 * `coupon_redemptions` is not touched here. Ending a campaign stops giving,
 * it does not take back.
 */
async function archiveCoupon(storeId: string, couponId: string) {
  const [archived] = await db
    .update(couponTable)
    .set({ status: "archived" })
    .where(and(eq(couponTable.id, couponId), eq(couponTable.storeId, storeId)))
    .returning();

  if (!archived) {
    throw couponNotFoundError();
  }

  return archived;
}

export default archiveCoupon;
