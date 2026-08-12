import { and, eq } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import db from "../../database";
import { couponTable } from "../../database/schema";

export function couponNotFoundError(): HTTPException {
  return new HTTPException(404, { message: "Campanha não encontrada" });
}

/** Always scoped by `storeId`, so another shop's campaign reads as missing. */
async function getCoupon(storeId: string, couponId: string) {
  const [coupon] = await db
    .select()
    .from(couponTable)
    .where(and(eq(couponTable.id, couponId), eq(couponTable.storeId, storeId)))
    .limit(1);

  if (!coupon) {
    throw couponNotFoundError();
  }

  return coupon;
}

export default getCoupon;
