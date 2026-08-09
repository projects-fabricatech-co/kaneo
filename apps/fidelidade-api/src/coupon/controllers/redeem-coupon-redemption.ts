import { and, eq, gt, isNull, or, sql } from "drizzle-orm";
import type { HTTPException } from "hono/http-exception";
import {
  codeAlreadyRedeemedError,
  codeExpiredError,
  codeNotFoundError,
  codeNotRedeemableError,
} from "../../code/code-error";
import db from "../../database";
import type { DatabaseExecutor } from "../../database/executor";
import {
  couponRedemptionTable,
  couponTable,
  storeTable,
} from "../../database/schema";

export type RedeemCouponRedemptionInput = {
  storeId: string;
  code: string;
  redeemedByUserId: string;
};

export type RedeemCouponRedemptionResult = {
  kind: "coupon";
  redemption: typeof couponRedemptionTable.$inferSelect;
  /** The campaign, so the screen can say what to take off the bill. */
  coupon: typeof couponTable.$inferSelect;
};

/**
 * Same job as `redeem-reward.ts`'s `explainFailure`, against the coupon tables:
 * ONE select, purely to pick which of the four messages the lojista gets. It
 * decides nothing — the outcome was settled by the UPDATE that matched no rows.
 */
async function explainFailure(
  tx: DatabaseExecutor,
  storeId: string,
  code: string,
): Promise<HTTPException> {
  const [row] = await tx
    .select({
      status: couponRedemptionTable.status,
      expiresAt: couponRedemptionTable.expiresAt,
      redeemedAt: couponRedemptionTable.redeemedAt,
      timezone: storeTable.timezone,
    })
    .from(couponRedemptionTable)
    .innerJoin(storeTable, eq(couponRedemptionTable.storeId, storeTable.id))
    .where(
      and(
        eq(couponRedemptionTable.storeId, storeId),
        eq(couponRedemptionTable.code, code),
      ),
    )
    .limit(1);

  if (!row) {
    return codeNotFoundError();
  }

  if (row.status === "redeemed") {
    return codeAlreadyRedeemedError(row.redeemedAt, row.timezone);
  }

  if (row.expiresAt && row.expiresAt.getTime() <= Date.now()) {
    return codeExpiredError(row.expiresAt, row.timezone);
  }

  return codeNotRedeemableError();
}

/**
 * Spending a coupon code, the `C` half of `POST /code/redeem`.
 *
 * ONE conditional UPDATE, exactly as a prize is spent: under READ COMMITTED the
 * second of two concurrent statements on the same row blocks, re-reads the
 * committed result, finds `status = 'redeemed'` and matches nothing. Two
 * cashiers scanning the same phone produce one success and one 409.
 *
 * Nothing cascades: unlike a prize, a coupon has no card to close and no cycle
 * to open. `coupons.redemption_count` was already spent at CLAIM time — that
 * column counts codes handed out, not codes used at the counter, which is why
 * redeeming must not touch it.
 */
async function redeemCouponRedemption(
  input: RedeemCouponRedemptionInput,
): Promise<RedeemCouponRedemptionResult> {
  const { storeId, code, redeemedByUserId } = input;

  return db.transaction(async (tx) => {
    const [redemption] = await tx
      .update(couponRedemptionTable)
      .set({
        status: "redeemed",
        redeemedAt: sql`now()`,
        redeemedByUserId,
      })
      .where(
        and(
          eq(couponRedemptionTable.storeId, storeId),
          eq(couponRedemptionTable.code, code),
          eq(couponRedemptionTable.status, "pending"),
          or(
            isNull(couponRedemptionTable.expiresAt),
            gt(couponRedemptionTable.expiresAt, sql`now()`),
          ),
        ),
      )
      .returning();

    if (!redemption) {
      throw await explainFailure(tx, storeId, code);
    }

    const [coupon] = await tx
      .select()
      .from(couponTable)
      .where(eq(couponTable.id, redemption.couponId))
      .limit(1);

    if (!coupon) {
      // Unreachable while the foreign key holds; answering with a 409 rather
      // than a 500 keeps the counter screen on a path it already handles.
      throw codeNotRedeemableError();
    }

    return { kind: "coupon", redemption, coupon };
  });
}

export default redeemCouponRedemption;
