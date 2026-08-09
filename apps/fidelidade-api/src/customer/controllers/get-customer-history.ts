import { and, desc, eq, isNull, sql } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import db from "../../database";
import {
  cardTable,
  couponRedemptionTable,
  couponTable,
  customerTable,
  programTable,
  rewardTable,
  stampTable,
} from "../../database/schema";

export type CustomerHistory = {
  customer: {
    id: string;
    name: string | null;
    phone: string;
  };
  cards: Array<{
    id: string;
    programId: string;
    programName: string;
    cycle: number;
    stampsCount: number;
    stampsRequired: number;
    status: string;
    completedAt: Date | null;
    redeemedAt: Date | null;
    createdAt: Date;
  }>;
  rewards: Array<{
    id: string;
    code: string;
    description: string;
    status: string;
    expiresAt: Date | null;
    redeemedAt: Date | null;
    createdAt: Date;
  }>;
  coupons: Array<{
    id: string;
    couponId: string;
    code: string;
    title: string;
    discountLabel: string;
    status: string;
    expiresAt: Date | null;
    redeemedAt: Date | null;
    createdAt: Date;
  }>;
  totals: {
    totalStamps: number;
    totalRewards: number;
    /** Prizes actually collected — `rewards.status = 'redeemed'`. */
    totalRedeemed: number;
  };
};

/**
 * Everything about one customer, for the sheet that opens when the lojista taps
 * a name. Cashier-readable: the person is standing at the counter asking why
 * their card says 8 and not 9.
 *
 * `storeId` is part of EVERY where clause, not only of the access check the
 * middleware already did — the id in the URL is user input, and a query that
 * relies on a middleware three layers up for its tenant scope is one refactor
 * away from being cross-tenant.
 */
async function getCustomerHistory(
  storeId: string,
  customerId: string,
): Promise<CustomerHistory> {
  // `::int` because `count()` is a bigint, which node-postgres hands back as a
  // string — the totals would render as "2" and add up by concatenation.
  const countAll = sql<number>`count(*)::int`;

  const totalStamps = db
    .select({ value: countAll })
    .from(stampTable)
    .where(
      and(
        eq(stampTable.storeId, customerTable.storeId),
        eq(stampTable.customerId, customerTable.id),
        // A voided stamp was undone at the counter and the card was decremented
        // with it; counting it would contradict the cards on the same screen.
        isNull(stampTable.voidedAt),
      ),
    );

  const totalRewards = db
    .select({ value: countAll })
    .from(rewardTable)
    .where(
      and(
        eq(rewardTable.storeId, customerTable.storeId),
        eq(rewardTable.customerId, customerTable.id),
      ),
    );

  const totalRedeemed = db
    .select({ value: countAll })
    .from(rewardTable)
    .where(
      and(
        eq(rewardTable.storeId, customerTable.storeId),
        eq(rewardTable.customerId, customerTable.id),
        eq(rewardTable.status, "redeemed"),
      ),
    );

  // The identity row and the three totals in one trip; it also doubles as the
  // existence check, so a customer from another store never reaches the lists
  // below.
  const [head] = await db
    .select({
      id: customerTable.id,
      name: customerTable.name,
      phone: customerTable.phone,
      totalStamps: sql<number>`(${totalStamps})`,
      totalRewards: sql<number>`(${totalRewards})`,
      totalRedeemed: sql<number>`(${totalRedeemed})`,
    })
    .from(customerTable)
    .where(
      and(eq(customerTable.id, customerId), eq(customerTable.storeId, storeId)),
    )
    .limit(1);

  if (!head) {
    throw new HTTPException(404, { message: "Cliente não encontrado" });
  }

  const [cards, rewards, coupons] = await Promise.all([
    // Ordered by `createdAt` and not by `cycle`: a store can run more than one
    // program, and cycle numbers restart per program — sorting on them would
    // interleave the café card's cycle 3 with the almoço card's cycle 3.
    db
      .select({
        id: cardTable.id,
        programId: cardTable.programId,
        programName: programTable.name,
        cycle: cardTable.cycle,
        stampsCount: cardTable.stampsCount,
        stampsRequired: cardTable.stampsRequired,
        status: cardTable.status,
        completedAt: cardTable.completedAt,
        redeemedAt: cardTable.redeemedAt,
        createdAt: cardTable.createdAt,
      })
      .from(cardTable)
      .innerJoin(programTable, eq(programTable.id, cardTable.programId))
      .where(
        and(
          eq(cardTable.storeId, storeId),
          eq(cardTable.customerId, customerId),
        ),
      )
      .orderBy(desc(cardTable.createdAt), desc(cardTable.id)),

    db
      .select({
        id: rewardTable.id,
        code: rewardTable.code,
        description: rewardTable.description,
        status: rewardTable.status,
        expiresAt: rewardTable.expiresAt,
        redeemedAt: rewardTable.redeemedAt,
        createdAt: rewardTable.createdAt,
      })
      .from(rewardTable)
      .where(
        and(
          eq(rewardTable.storeId, storeId),
          eq(rewardTable.customerId, customerId),
        ),
      )
      .orderBy(desc(rewardTable.createdAt), desc(rewardTable.id)),

    db
      .select({
        id: couponRedemptionTable.id,
        couponId: couponRedemptionTable.couponId,
        code: couponRedemptionTable.code,
        title: couponTable.title,
        discountLabel: couponTable.discountLabel,
        status: couponRedemptionTable.status,
        expiresAt: couponRedemptionTable.expiresAt,
        redeemedAt: couponRedemptionTable.redeemedAt,
        createdAt: couponRedemptionTable.createdAt,
      })
      .from(couponRedemptionTable)
      .innerJoin(
        couponTable,
        eq(couponTable.id, couponRedemptionTable.couponId),
      )
      .where(
        and(
          eq(couponRedemptionTable.storeId, storeId),
          eq(couponRedemptionTable.customerId, customerId),
        ),
      )
      .orderBy(
        desc(couponRedemptionTable.createdAt),
        desc(couponRedemptionTable.id),
      ),
  ]);

  return {
    customer: { id: head.id, name: head.name, phone: head.phone },
    cards,
    rewards,
    coupons,
    totals: {
      totalStamps: head.totalStamps,
      totalRewards: head.totalRewards,
      totalRedeemed: head.totalRedeemed,
    },
  };
}

export default getCustomerHistory;
