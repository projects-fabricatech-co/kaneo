import { and, eq } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import { isSoldOut, liveCouponWhere } from "../../coupon/coupon-window";
import db from "../../database";
import { couponTable, storeTable } from "../../database/schema";
import { resolvePlanForStore } from "../../plans/resolve-plan";

/** Matches `stores.brand_color`'s column default, as in `get-public-card.ts`. */
const DEFAULT_BRAND_COLOR = "#D93825";

export type PublicCouponResponse = {
  title: string;
  description: string | null;
  discountLabel: string;
  endsAt: string | null;
  soldOut: boolean;
  store: {
    name: string;
    logoUrl: string | null;
    brandColor: string;
    city: string | null;
  };
};

export function publicCouponNotFoundError(): HTTPException {
  return new HTTPException(404, { message: "Campanha não encontrada" });
}

/**
 * The campaign landing page. UNAUTHENTICATED, addressed by a token in a URL, and
 * printed on a poster — so unlike the customer's card, this link is meant to be
 * public and is not a secret. That makes the projection stricter, not looser.
 *
 * Every field is written out by hand. NEVER present: `redemptionCount`,
 * `maxRedemptions` (only the boolean `soldOut` derived from them), any id, the
 * store's slug, whatsapp or owner, and anything at all about the people who
 * already claimed. A spread here would leak the next column somebody adds.
 *
 * 404, with one message, for four different situations: unknown token, a draft
 * still being written, an ended campaign, and one that has not started. Which of
 * them it is, is the shop's business.
 */
async function getPublicCoupon(token: string): Promise<PublicCouponResponse> {
  const [coupon] = await db
    .select({
      storeId: couponTable.storeId,
      title: couponTable.title,
      description: couponTable.description,
      discountLabel: couponTable.discountLabel,
      endsAt: couponTable.endsAt,
      maxRedemptions: couponTable.maxRedemptions,
      redemptionCount: couponTable.redemptionCount,
    })
    .from(couponTable)
    .where(and(eq(couponTable.publicToken, token), liveCouponWhere()))
    .limit(1);

  if (!coupon) {
    throw publicCouponNotFoundError();
  }

  const [store] = await db
    .select({
      name: storeTable.name,
      logoUrl: storeTable.logoUrl,
      brandColor: storeTable.brandColor,
      city: storeTable.city,
    })
    .from(storeTable)
    .where(eq(storeTable.id, coupon.storeId))
    .limit(1);

  if (!store) {
    throw publicCouponNotFoundError();
  }

  // Branding is a paid feature and a downgraded store keeps its logo and colour
  // in the database, so the gate is applied at render time — exactly as on the
  // public card, and for the same reason.
  const { limits } = await resolvePlanForStore(coupon.storeId);

  return {
    title: coupon.title,
    description: coupon.description,
    discountLabel: coupon.discountLabel,
    endsAt: coupon.endsAt ? coupon.endsAt.toISOString() : null,
    // The cap as one boolean. The numbers behind it are the shop's business:
    // "3 restantes" is a growth tactic, and it is not this endpoint's call.
    soldOut: isSoldOut(coupon),
    store: {
      name: store.name,
      logoUrl: limits.branding ? store.logoUrl : null,
      brandColor: limits.branding ? store.brandColor : DEFAULT_BRAND_COLOR,
      city: store.city,
    },
  };
}

export default getPublicCoupon;
