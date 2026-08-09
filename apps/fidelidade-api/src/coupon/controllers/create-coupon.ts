import { HTTPException } from "hono/http-exception";
import db from "../../database";
import { couponTable } from "../../database/schema";
import { generatePublicToken } from "../../utils/tokens";
import { type DiscountType, resolveDiscount } from "../discount";

export type CreateCouponInput = {
  title: string;
  description?: string | null;
  discountType: DiscountType;
  discountValue?: number | null;
  discountLabel?: string | null;
  status?: "draft" | "active";
  startsAt?: Date | null;
  endsAt?: Date | null;
  maxRedemptions?: number | null;
  redemptionValidityDays?: number;
};

export function invalidCouponWindowError(): HTTPException {
  return new HTTPException(400, {
    message: "A data de término precisa ser depois da data de início",
  });
}

export function assertCouponWindow(
  startsAt: Date | null,
  endsAt: Date | null,
): void {
  if (startsAt && endsAt && endsAt.getTime() <= startsAt.getTime()) {
    throw invalidCouponWindowError();
  }
}

/**
 * One campaign, one link. `publicToken` is minted here and never rotates: it is
 * printed on the counter QR, so changing it would kill posters already on the
 * wall.
 */
async function createCoupon(storeId: string, input: CreateCouponInput) {
  const discount = resolveDiscount(input);
  const startsAt = input.startsAt ?? null;
  const endsAt = input.endsAt ?? null;

  assertCouponWindow(startsAt, endsAt);

  const [created] = await db
    .insert(couponTable)
    .values({
      storeId,
      title: input.title.trim(),
      description: input.description?.trim() || null,
      discountType: discount.discountType,
      discountValue: discount.discountValue,
      discountLabel: discount.discountLabel,
      publicToken: generatePublicToken(),
      startsAt,
      endsAt,
      maxRedemptions: input.maxRedemptions ?? null,
      ...(input.status ? { status: input.status } : {}),
      ...(input.redemptionValidityDays !== undefined
        ? { redemptionValidityDays: input.redemptionValidityDays }
        : {}),
    })
    .returning();

  if (!created) {
    throw new HTTPException(500, {
      message: "Não foi possível criar a campanha",
    });
  }

  return created;
}

export default createCoupon;
