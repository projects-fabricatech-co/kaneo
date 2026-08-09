import { and, desc, eq } from "drizzle-orm";
import db from "../../database";
import { couponRedemptionTable, customerTable } from "../../database/schema";
import getCoupon from "./get-coupon";

/**
 * Who claimed the campaign, for the lojista. AUTHENTICATED and store-scoped, so
 * the customer's name and phone are fair game — this is the shop's own base, and
 * the whole point of a coupon here is that it feeds the loyalty program.
 *
 * `getCoupon` first, so a campaign belonging to another store 404s instead of
 * returning an empty list that would confirm the id exists.
 */
async function listCouponRedemptions(storeId: string, couponId: string) {
  await getCoupon(storeId, couponId);

  return db
    .select({
      id: couponRedemptionTable.id,
      couponId: couponRedemptionTable.couponId,
      code: couponRedemptionTable.code,
      status: couponRedemptionTable.status,
      expiresAt: couponRedemptionTable.expiresAt,
      redeemedAt: couponRedemptionTable.redeemedAt,
      redeemedByUserId: couponRedemptionTable.redeemedByUserId,
      createdAt: couponRedemptionTable.createdAt,
      customer: {
        id: customerTable.id,
        name: customerTable.name,
        phone: customerTable.phone,
      },
    })
    .from(couponRedemptionTable)
    .innerJoin(
      customerTable,
      eq(couponRedemptionTable.customerId, customerTable.id),
    )
    .where(
      and(
        eq(couponRedemptionTable.storeId, storeId),
        eq(couponRedemptionTable.couponId, couponId),
      ),
    )
    .orderBy(desc(couponRedemptionTable.createdAt));
}

export default listCouponRedemptions;
