import { and, eq, isNull, lt, or, sql } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import { liveCouponWhere } from "../../coupon/coupon-window";
import findOrCreateCustomer from "../../customer/controllers/find-or-create-customer";
import db from "../../database";
import type { DatabaseExecutor } from "../../database/executor";
import {
  consentRecordTable,
  couponRedemptionTable,
  couponTable,
} from "../../database/schema";
import { rewardExpiresAt } from "../../reward/reward-expiry";
import { generateShortCode } from "../../utils/short-code";
import { publicCouponNotFoundError } from "./get-public-coupon";

/** Fresh code attempts before giving up. See `insert-with-unique-code.ts`. */
const MAX_CODE_ATTEMPTS = 5;

export type ClaimPublicCouponInput = {
  phone: string;
  name?: string | null;
  /**
   * Identifier of the consent text the person ticked. Not optional: this is the
   * one place in the product where a customer enrols themselves, so it is the
   * one place where consent is the legal basis, and LGPD art. 8º, §1º puts the
   * burden of demonstrating it on the controller.
   */
  consentVersion: string;
  /** Recorded with the consent so it can be attributed. Never read back. */
  consentIp?: string | null;
};

export type ClaimPublicCouponResult = {
  code: string;
  expiresAt: string | null;
  /** Only for a customer this claim just enrolled; null for a returning one. */
  cardUrl: string | null;
};

export function couponSoldOutError(): HTTPException {
  return new HTTPException(409, {
    res: Response.json(
      {
        error: "coupon_sold_out",
        message: "Cupom esgotado",
      },
      { status: 409 },
    ),
  });
}

function cardUrlFor(customerPublicToken: string): string {
  const base = (
    process.env.FIDELIDADE_CLIENT_URL || "http://localhost:5174"
  ).replace(/\/+$/, "");

  return `${base}/c/${customerPublicToken}`;
}

async function findRedemption(
  tx: DatabaseExecutor,
  couponId: string,
  customerId: string,
) {
  const [row] = await tx
    .select()
    .from(couponRedemptionTable)
    .where(
      and(
        eq(couponRedemptionTable.couponId, couponId),
        eq(couponRedemptionTable.customerId, customerId),
      ),
    )
    .limit(1);

  return row ?? null;
}

/**
 * THE ONLY UNAUTHENTICATED WRITE IN THE PRODUCT.
 *
 * A person scans the poster, types their phone, and walks away with a code that
 * is theirs alone — and, because claiming enrols them, with a loyalty card in
 * this shop. That is the whole product decision in one endpoint: a coupon is an
 * acquisition channel, not a leaflet.
 *
 * ─── ORDERING, and why refreshing the page cannot burn two slots ───────────
 *
 * Three writes are in play: enrol the customer, take a slot from the campaign
 * cap, and mint the code. They run in this order:
 *
 *   0. `findOrCreateCustomer` — outside the transaction, because it owns one.
 *      A claim therefore enrols the person even if the campaign turns out to be
 *      full. Deliberate: the customer id is what makes every step below
 *      idempotent, and somebody who came to the counter's link belongs in the
 *      base whether or not the last code was gone.
 *
 *   1. FAST PATH — select this customer's existing redemption for this
 *      campaign. Found means they already claimed: return the SAME code and
 *      touch NOTHING. This is the refresh, the second scan, the shared phone.
 *      It is a read, so it can never consume a slot.
 *
 *   2. GUARDED INCREMENT, before the insert, as one atomic statement:
 *      `... SET redemption_count = redemption_count + 1
 *         WHERE id = $1 AND (max_redemptions IS NULL
 *                            OR redemption_count < max_redemptions)`
 *      Zero rows means full. Before answering 409 it re-checks step 1: a
 *      concurrent claim by THIS customer may have committed in between, and
 *      somebody who already holds a code must keep getting it even after the
 *      campaign fills up.
 *
 *   3. INSERT the redemption, conflicts swallowed. If the insert no-ops on
 *      `(coupon_id, customer_id)` — the same customer's concurrent claim
 *      committed between steps 1 and 3 — the slot taken in step 2 is given back
 *      with a compensating decrement IN THE SAME TRANSACTION, so the net effect
 *      is zero and no observer ever sees the intermediate count.
 *
 * Every transaction takes the coupon row lock (step 2) BEFORE the redemption
 * index lock (step 3), never the reverse, so two concurrent claims cannot
 * deadlock: the second one blocks at step 2 and re-evaluates its guard against
 * the first one's committed count.
 *
 * The cap is arbitrated by step 2 and nothing else. `soldOut` on the landing
 * page is a rendering hint; a read-then-decide check anywhere here would be a
 * race with real money on the other side of it.
 */
async function claimPublicCoupon(
  token: string,
  input: ClaimPublicCouponInput,
): Promise<ClaimPublicCouponResult> {
  const [coupon] = await db
    .select({
      id: couponTable.id,
      storeId: couponTable.storeId,
      redemptionValidityDays: couponTable.redemptionValidityDays,
    })
    .from(couponTable)
    .where(and(eq(couponTable.publicToken, token), liveCouponWhere()))
    .limit(1);

  if (!coupon) {
    throw publicCouponNotFoundError();
  }

  // May throw 422 (unusable phone) or 402 (the store's customer ceiling on
  // Grátis). Both are the honest answer: there is no code without a customer.
  const { customer, created } = await findOrCreateCustomer(coupon.storeId, {
    phone: input.phone,
    name: input.name,
  });

  /**
   * THE CARD LINK IS ONLY EVER HANDED TO SOMEBODY WE JUST ENROLLED.
   *
   * `customers.publicToken` is the single credential protecting a card, and this
   * endpoint is unauthenticated: the campaign link is printed on a poster and
   * posted to Instagram, so it is not a secret by design. Returning the token for
   * a customer who ALREADY existed meant that anyone holding the poster plus a
   * phone number — a number, not a proof of owning it — received that person's
   * card link, and with it their name, their visit history and every live
   * single-use reward code, which they could then spend at the counter. Silently:
   * a repeat claim returns early, so no slot moves and nothing is logged.
   *
   * Typing a phone number does not prove possession of the phone. It proves it
   * for exactly one case — the person who was not in the base a moment ago and
   * whose card therefore contains nothing but what they just earned. That is the
   * only case that gets a link.
   *
   * A returning visitor still gets their code, which is safe: the redemption is
   * unique on `(coupon_id, customer_id)`, so they can only ever be shown their
   * own. To reach their card they use the link they already have, or ask at the
   * counter.
   */
  const cardUrl = created ? cardUrlFor(customer.publicToken) : null;

  /**
   * The consent is recorded HERE — pinned to the enrolment above, not to the
   * code below.
   *
   * The tempting place is inside the transaction, next to the code, so that
   * consent and benefit commit together. It is the wrong place: step 0 already
   * put this person in the store's base, and it does so even when the campaign
   * turns out to be full. Recording the consent only on a successful claim
   * would leave exactly the people whose claim failed sitting in the base with
   * no record of what they agreed to — the one case where the record matters
   * most, because they got nothing in return for the data.
   *
   * Conflicts are swallowed: a refresh, a retry, or a second scan is the same
   * agreement to the same text, not a new one. See the unique index.
   */
  await db
    .insert(consentRecordTable)
    .values({
      storeId: coupon.storeId,
      customerId: customer.id,
      couponId: coupon.id,
      source: "coupon_claim",
      textVersion: input.consentVersion,
      ipAddress: input.consentIp ?? null,
    })
    .onConflictDoNothing();

  const redemption = await db.transaction(async (tx) => {
    // 1. Fast path: already claimed, so nothing to count and nothing to mint.
    const existing = await findRedemption(tx, coupon.id, customer.id);

    if (existing) {
      return existing;
    }

    // 2. Take a slot, atomically, guarded by the cap.
    const [bumped] = await tx
      .update(couponTable)
      .set({
        redemptionCount: sql`${couponTable.redemptionCount} + 1`,
      })
      .where(
        and(
          eq(couponTable.id, coupon.id),
          or(
            isNull(couponTable.maxRedemptions),
            lt(couponTable.redemptionCount, couponTable.maxRedemptions),
          ),
        ),
      )
      .returning({ redemptionCount: couponTable.redemptionCount });

    if (!bumped) {
      // Full — unless this very customer's concurrent claim is what filled it.
      const raced = await findRedemption(tx, coupon.id, customer.id);

      if (raced) {
        return raced;
      }

      throw couponSoldOutError();
    }

    // 3. Mint the code. The validity rule is identical to a prize's — N days
    // from now, non-positive meaning "never" as a NULL — so it is imported
    // rather than copied.
    const expiresAt = rewardExpiresAt(
      coupon.redemptionValidityDays,
      new Date(),
    );

    for (let attempt = 0; attempt < MAX_CODE_ATTEMPTS; attempt += 1) {
      // ON CONFLICT DO NOTHING with NO target, so BOTH unique indexes on this
      // table are swallowed: `(coupon_id, customer_id)` — a repeat claim — and
      // `(store_id, code)` — a 1-in-729-million code collision. They are told
      // apart by the select below, which is why this cannot reuse
      // `insertWithUniqueCode`: that helper targets the code index alone, so a
      // repeat claim would escape it as a 500.
      const [inserted] = await tx
        .insert(couponRedemptionTable)
        .values({
          storeId: coupon.storeId,
          couponId: coupon.id,
          customerId: customer.id,
          code: generateShortCode("coupon"),
          expiresAt,
        })
        .onConflictDoNothing()
        .returning();

      if (inserted) {
        return inserted;
      }

      const raced = await findRedemption(tx, coupon.id, customer.id);

      if (raced) {
        // The customer already had a code. Give the slot back: same
        // transaction, so the +1 and the -1 are one atomic no-op.
        await tx
          .update(couponTable)
          .set({
            redemptionCount: sql`greatest(${couponTable.redemptionCount} - 1, 0)`,
          })
          .where(eq(couponTable.id, coupon.id));

        return raced;
      }

      // Otherwise it was a code collision: try again with a fresh one.
    }

    throw new HTTPException(500, {
      message: "Não foi possível gerar o código",
    });
  });

  return {
    code: redemption.code,
    expiresAt: redemption.expiresAt ? redemption.expiresAt.toISOString() : null,
    cardUrl,
  };
}

export default claimPublicCoupon;
