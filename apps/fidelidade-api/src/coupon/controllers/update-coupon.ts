import { and, eq } from "drizzle-orm";
import db from "../../database";
import { couponTable } from "../../database/schema";
import { type DiscountType, resolveDiscount } from "../discount";
import { assertCouponWindow } from "./create-coupon";
import getCoupon, { couponNotFoundError } from "./get-coupon";

export type UpdateCouponInput = {
  title?: string;
  description?: string | null;
  discountType?: DiscountType;
  discountValue?: number | null;
  discountLabel?: string | null;
  status?: "draft" | "active" | "archived";
  startsAt?: Date | null;
  endsAt?: Date | null;
  maxRedemptions?: number | null;
  redemptionValidityDays?: number;
};

/**
 * `redemptionValidityDays` and the discount apply from here on. Codes already
 * handed out keep the `expires_at` and the label they were minted with — the
 * customer holds a promise, not a pointer.
 *
 * `maxRedemptions` can be lowered below `redemptionCount`; that is deliberate
 * and simply means the campaign is now full. Nothing already claimed is revoked,
 * and the guarded UPDATE at claim time reads the new cap on its next attempt.
 */
async function updateCoupon(
  storeId: string,
  couponId: string,
  input: UpdateCouponInput,
) {
  const existing = await getCoupon(storeId, couponId);

  const values: Partial<typeof couponTable.$inferInsert> = {};

  if (input.title !== undefined) {
    values.title = input.title.trim();
  }

  if (input.description !== undefined) {
    values.description = input.description?.trim() || null;
  }

  const discountChanged =
    (input.discountType !== undefined &&
      input.discountType !== existing.discountType) ||
    (input.discountValue !== undefined &&
      input.discountValue !== existing.discountValue);

  if (
    input.discountType !== undefined ||
    input.discountValue !== undefined ||
    input.discountLabel !== undefined
  ) {
    const discount = resolveDiscount({
      discountType: (input.discountType ??
        existing.discountType) as DiscountType,
      discountValue:
        input.discountValue !== undefined
          ? input.discountValue
          : existing.discountValue,
      // An explicit label always wins. Otherwise the stored one is kept, EXCEPT
      // when the discount itself moved — "20% OFF" left on a campaign that is
      // now 30% is worse than a re-derived label, and the lojista who wrote a
      // custom label can always send it again.
      discountLabel:
        input.discountLabel ??
        (discountChanged ? null : existing.discountLabel),
    });

    values.discountType = discount.discountType;
    values.discountValue = discount.discountValue;
    values.discountLabel = discount.discountLabel;
  }

  if (input.status !== undefined) {
    values.status = input.status;
  }

  if (input.startsAt !== undefined) {
    values.startsAt = input.startsAt;
  }

  if (input.endsAt !== undefined) {
    values.endsAt = input.endsAt;
  }

  if (input.maxRedemptions !== undefined) {
    values.maxRedemptions = input.maxRedemptions;
  }

  if (input.redemptionValidityDays !== undefined) {
    values.redemptionValidityDays = input.redemptionValidityDays;
  }

  assertCouponWindow(
    input.startsAt !== undefined ? input.startsAt : existing.startsAt,
    input.endsAt !== undefined ? input.endsAt : existing.endsAt,
  );

  if (Object.keys(values).length === 0) {
    return existing;
  }

  const [updated] = await db
    .update(couponTable)
    .set(values)
    .where(and(eq(couponTable.id, couponId), eq(couponTable.storeId, storeId)))
    .returning();

  if (!updated) {
    throw couponNotFoundError();
  }

  return updated;
}

export default updateCoupon;
