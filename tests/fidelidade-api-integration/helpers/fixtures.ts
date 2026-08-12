import { createId } from "@paralleldrive/cuid2";
import { and, eq, max, sql } from "drizzle-orm";
import db from "../../../apps/fidelidade-api/src/database";
import {
  cardTable,
  couponRedemptionTable,
  couponTable,
  customerTable,
  platformAdminTable,
  programTable,
  rewardTable,
  stampTable,
  storeMemberTable,
  storeTable,
  subscriptionTable,
  userTable,
} from "../../../apps/fidelidade-api/src/database/schema";
import type { PlanId } from "../../../apps/fidelidade-api/src/plans/limits";
import { generateShortCode } from "../../../apps/fidelidade-api/src/utils/short-code";
import { generatePublicToken } from "../../../apps/fidelidade-api/src/utils/tokens";

type SeededUser = typeof userTable.$inferSelect;
type SeededStore = typeof storeTable.$inferSelect;

export async function createUser(
  overrides: Partial<typeof userTable.$inferInsert> = {},
): Promise<SeededUser> {
  const suffix = createId().slice(0, 8);

  const [user] = await db
    .insert(userTable)
    .values({
      name: overrides.name ?? `Lojista ${suffix}`,
      email: overrides.email ?? `lojista-${suffix}@example.com`,
      emailVerified: true,
      ...overrides,
    })
    .returning();

  if (!user) {
    throw new Error("failed to seed user");
  }

  return user;
}

/** Gives a user a subscription row so paid-plan code paths can be exercised. */
export async function grantPlan(
  ownerUserId: string,
  plan: PlanId,
  overrides: Partial<typeof subscriptionTable.$inferInsert> = {},
) {
  const [subscription] = await db
    .insert(subscriptionTable)
    .values({
      ownerUserId,
      plan,
      status: "active",
      ...overrides,
    })
    .returning();

  return subscription;
}

/**
 * A store plus its owner. The owner gets a `store_members` row exactly as the
 * real controller creates it, so access checks behave identically.
 */
export async function createStoreOwner(
  options: { storeName?: string; plan?: PlanId; timezone?: string } = {},
): Promise<{ user: SeededUser; store: SeededStore }> {
  const user = await createUser();
  const suffix = createId().slice(0, 8);

  if (options.plan && options.plan !== "gratis") {
    await grantPlan(user.id, options.plan);
  }

  const [store] = await db
    .insert(storeTable)
    .values({
      ownerUserId: user.id,
      name: options.storeName ?? `Loja ${suffix}`,
      slug: `loja-${suffix}`,
      // Written out rather than left to the column default: the dashboard
      // buckets by this value, and a test that says nothing about the timezone
      // would silently start depending on whatever the default becomes.
      timezone: options.timezone ?? "America/Sao_Paulo",
    })
    .returning();

  if (!store) {
    throw new Error("failed to seed store");
  }

  await db.insert(storeMemberTable).values({
    storeId: store.id,
    userId: user.id,
    role: "owner",
  });

  return { user, store };
}

/** A second user attached to an existing store as a cashier. */
export async function createStoreCashier(storeId: string): Promise<SeededUser> {
  const user = await createUser();

  await db.insert(storeMemberTable).values({
    storeId,
    userId: user.id,
    role: "cashier",
  });

  return user;
}

let subscriberCounter = 900000000;

/** Distinct, valid 9-digit mobile subscriber numbers, in seed order. */
function nextSubscriber(): string {
  subscriberCounter += 1;
  return String(subscriberCounter);
}

/**
 * A loyalty program, seeded directly. `cooldownMinutes: 0` is the usual choice in
 * tests that stamp repeatedly — the cooldown itself is exercised on purpose in
 * `stamp-concurrency.test.ts`.
 */
export async function createProgram(
  storeId: string,
  overrides: Partial<typeof programTable.$inferInsert> = {},
) {
  const suffix = createId().slice(0, 8);

  const [program] = await db
    .insert(programTable)
    .values({
      storeId,
      name: overrides.name ?? `Programa ${suffix}`,
      rewardDescription: overrides.rewardDescription ?? "Um café grátis",
      ...overrides,
    })
    .returning();

  if (!program) {
    throw new Error("failed to seed program");
  }

  return program;
}

/** Phones are seeded already normalized, exactly as the controller stores them. */
export async function createCustomer(
  storeId: string,
  overrides: Partial<typeof customerTable.$inferInsert> = {},
) {
  const [customer] = await db
    .insert(customerTable)
    .values({
      storeId,
      phone: overrides.phone ?? `+5511${nextSubscriber()}`,
      publicToken: overrides.publicToken ?? generatePublicToken(),
      ...overrides,
    })
    .returning();

  if (!customer) {
    throw new Error("failed to seed customer");
  }

  return customer;
}

/** Fills a store up to `count` customers, to sit right under a plan ceiling. */
export async function seedCustomers(storeId: string, count: number) {
  const rows = Array.from({ length: count }, () => ({
    storeId,
    phone: `+5511${nextSubscriber()}`,
    publicToken: generatePublicToken(),
  }));

  if (rows.length === 0) {
    return [];
  }

  return db.insert(customerTable).values(rows).returning();
}

/** The next free cycle for a program/customer pair, so seeded cards never
 * collide with `cards_program_customer_cycle_unique`. */
async function nextCycle(programId: string, customerId: string) {
  const [row] = await db
    .select({ value: max(cardTable.cycle) })
    .from(cardTable)
    .where(
      and(
        eq(cardTable.programId, programId),
        eq(cardTable.customerId, customerId),
      ),
    );

  return Number(row?.value ?? 0) + 1;
}

/**
 * A card in a chosen state, seeded DIRECTLY.
 *
 * The dashboard's "quase lá" tile is about cards sitting at 8/10 and 9/10, and
 * stamping one there through the API would test `create-stamp` eight times over
 * instead of the counter under test.
 */
export async function createCard(
  storeId: string,
  programId: string,
  customerId: string,
  overrides: Partial<typeof cardTable.$inferInsert> = {},
) {
  const [card] = await db
    .insert(cardTable)
    .values({
      storeId,
      programId,
      customerId,
      cycle: overrides.cycle ?? (await nextCycle(programId, customerId)),
      stampsRequired: overrides.stampsRequired ?? 10,
      ...overrides,
    })
    .returning();

  if (!card) {
    throw new Error("failed to seed card");
  }

  return card;
}

/**
 * A stamp at a CHOSEN instant, seeded DIRECTLY and WITHOUT touching the card's
 * counter.
 *
 * The whole point of the dashboard's day bucketing is where a row falls on the
 * store's calendar, so a test about the midnight boundary has to place the
 * instant itself — going through the API would stamp "now", and the assertion
 * would then depend on what time the suite happens to run.
 */
export async function createStamp(
  card: {
    id: string;
    storeId: string;
    programId: string;
    customerId: string;
  },
  overrides: Partial<typeof stampTable.$inferInsert> = {},
) {
  const [stamp] = await db
    .insert(stampTable)
    .values({
      storeId: card.storeId,
      programId: card.programId,
      customerId: card.customerId,
      cardId: card.id,
      ...overrides,
    })
    .returning();

  if (!stamp) {
    throw new Error("failed to seed stamp");
  }

  return stamp;
}

/**
 * A completed card plus the reward it carries, seeded DIRECTLY.
 *
 * Tests about redemption need a code in a specific state — expired, already
 * used, belonging to another store — and stamping a card ten times to reach each
 * one would test `create-stamp` all over again instead of the thing under test.
 * The minting path itself is covered end-to-end in `reward.test.ts`.
 */
export async function createRewardWithCard(
  storeId: string,
  programId: string,
  customerId: string,
  overrides: Partial<typeof rewardTable.$inferInsert> = {},
) {
  const [card] = await db
    .insert(cardTable)
    .values({
      storeId,
      programId,
      customerId,
      cycle: await nextCycle(programId, customerId),
      stampsCount: 1,
      stampsRequired: 1,
      status: "completed",
      completedAt: new Date(),
    })
    .returning();

  if (!card) {
    throw new Error("failed to seed card");
  }

  const [reward] = await db
    .insert(rewardTable)
    .values({
      storeId,
      programId,
      customerId,
      cardId: card.id,
      code: generateShortCode("reward"),
      description: "Um café grátis",
      ...overrides,
    })
    .returning();

  if (!reward) {
    throw new Error("failed to seed reward");
  }

  return { card, reward };
}

/**
 * A coupon campaign, seeded directly. Defaults to a live one: active, no window
 * and no cap, so a test only states the thing it is actually about.
 */
export async function createCoupon(
  storeId: string,
  overrides: Partial<typeof couponTable.$inferInsert> = {},
) {
  const suffix = createId().slice(0, 8);

  const [coupon] = await db
    .insert(couponTable)
    .values({
      storeId,
      title: overrides.title ?? `Campanha ${suffix}`,
      discountType: overrides.discountType ?? "percent",
      discountValue:
        overrides.discountValue === undefined ? 20 : overrides.discountValue,
      discountLabel: overrides.discountLabel ?? "20% OFF",
      publicToken: overrides.publicToken ?? generatePublicToken(),
      ...overrides,
    })
    .returning();

  if (!coupon) {
    throw new Error("failed to seed coupon");
  }

  return coupon;
}

/**
 * A claimed coupon code, seeded DIRECTLY — including `redemption_count`, which
 * the real claim path maintains. Tests about REDEEMING a code need one in a
 * given state (expired, spent, another store's) without re-testing the claim.
 * The claim path itself is covered end-to-end in `coupon-claim.test.ts`.
 */
export async function createCouponRedemption(
  storeId: string,
  couponId: string,
  customerId: string,
  overrides: Partial<typeof couponRedemptionTable.$inferInsert> = {},
) {
  const [redemption] = await db
    .insert(couponRedemptionTable)
    .values({
      storeId,
      couponId,
      customerId,
      code: generateShortCode("coupon"),
      ...overrides,
    })
    .returning();

  if (!redemption) {
    throw new Error("failed to seed coupon redemption");
  }

  await db
    .update(couponTable)
    .set({ redemptionCount: sql`${couponTable.redemptionCount} + 1` })
    .where(eq(couponTable.id, couponId));

  return redemption;
}

/**
 * The instant at which a wall-clock offset from TODAY'S local midnight falls, in
 * `timezone`. `{ hours: 23, minutes: 30 }` is tonight at half past eleven for
 * that store; `{ days: 1, minutes: 30 }` is half past midnight tomorrow.
 *
 * Computed by POSTGRES, not by `Date` arithmetic in the test: writing
 * `T23:30-03:00` would hardcode "São Paulo is UTC-3", which is the assumption
 * these tests exist to check rather than something they may lean on.
 */
export async function localInstant(
  timezone: string,
  offset: { days?: number; hours?: number; minutes?: number } = {},
): Promise<Date> {
  // Epoch milliseconds rather than the timestamptz itself: `db.execute` hands
  // raw driver values back without drizzle's column mappers, so a timestamp
  // would arrive as Postgres' own text format and have to be re-parsed.
  const { rows } = await db.execute<{ ms: string }>(sql`
    select (extract(epoch from (
      date_trunc('day', now() at time zone ${timezone}::text)
      + make_interval(
          days => ${offset.days ?? 0}::int,
          hours => ${offset.hours ?? 0}::int,
          mins => ${offset.minutes ?? 0}::int
        )
    ) at time zone ${timezone}::text) * 1000)::bigint as ms
  `);

  const ms = rows[0]?.ms;

  if (ms === undefined) {
    throw new Error("failed to resolve a local instant");
  }

  return new Date(Number(ms));
}

/**
 * Two completely independent stores, for asserting that neither can see the
 * other's data.
 */
export async function seedTwoIsolatedStores() {
  const a = await createStoreOwner({ storeName: "Padaria A" });
  const b = await createStoreOwner({ storeName: "Padaria B" });

  return { a, b };
}

/**
 * A user who administers the platform.
 *
 * `revokedAt` is settable so the revoked case can be seeded directly rather than
 * granted and then taken away — the grant path is not what those tests are about.
 */
export async function createPlatformAdmin(
  overrides: { revokedAt?: Date } = {},
): Promise<SeededUser> {
  const user = await createUser();

  await db.insert(platformAdminTable).values({
    userId: user.id,
    revokedAt: overrides.revokedAt ?? null,
  });

  return user;
}
