import { and, desc, eq } from "drizzle-orm";
import db from "../../database";
import { couponTable } from "../../database/schema";

export type ListCouponsOptions = {
  status?: "draft" | "active" | "archived";
};

/**
 * Archived campaigns are returned too, unlike `list-programs`: the lojista's
 * screen groups by status and "o que já rodou" is half of what they open it for.
 * Filtering is the caller's, via `?status=`.
 */
async function listCoupons(storeId: string, options: ListCouponsOptions = {}) {
  return db
    .select()
    .from(couponTable)
    .where(
      options.status
        ? and(
            eq(couponTable.storeId, storeId),
            eq(couponTable.status, options.status),
          )
        : eq(couponTable.storeId, storeId),
    )
    .orderBy(desc(couponTable.createdAt));
}

export default listCoupons;
