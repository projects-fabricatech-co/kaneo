import { and, eq } from "drizzle-orm";
import { codeNotFoundError } from "../../code/code-error";
import db from "../../database";
import { couponRedemptionTable, couponTable } from "../../database/schema";

export type CouponCodeState = "pending" | "redeemed" | "expired";

export type InspectCouponRedemptionResult = {
  kind: "coupon";
  code: string;
  /** What the cashier reads out: "Semana do Cliente — 20% OFF". */
  description: string;
  status: CouponCodeState;
  expiresAt: Date | null;
  redeemedAt: Date | null;
  usable: boolean;
};

/**
 * The `C` half of "Validar código", and the exact counterpart of
 * `inspect-reward.ts`: READ-ONLY, store-scoped, and an unusable code is a 200
 * describing why rather than an error.
 *
 * The shape is identical to a prize's on purpose — the counter screen renders
 * one result panel and switches on `kind` only for the wording.
 */
async function inspectCouponRedemption(
  storeId: string,
  code: string,
): Promise<InspectCouponRedemptionResult> {
  const [row] = await db
    .select({
      code: couponRedemptionTable.code,
      status: couponRedemptionTable.status,
      expiresAt: couponRedemptionTable.expiresAt,
      redeemedAt: couponRedemptionTable.redeemedAt,
      title: couponTable.title,
      discountLabel: couponTable.discountLabel,
    })
    .from(couponRedemptionTable)
    .innerJoin(couponTable, eq(couponRedemptionTable.couponId, couponTable.id))
    .where(
      and(
        eq(couponRedemptionTable.storeId, storeId),
        eq(couponRedemptionTable.code, code),
      ),
    )
    .limit(1);

  if (!row) {
    throw codeNotFoundError();
  }

  const state: CouponCodeState =
    row.status === "redeemed"
      ? "redeemed"
      : row.expiresAt && row.expiresAt.getTime() <= Date.now()
        ? "expired"
        : "pending";

  return {
    kind: "coupon",
    code: row.code,
    description: `${row.title} — ${row.discountLabel}`,
    status: state,
    expiresAt: row.expiresAt,
    redeemedAt: row.redeemedAt,
    usable: state === "pending",
  };
}

export default inspectCouponRedemption;
