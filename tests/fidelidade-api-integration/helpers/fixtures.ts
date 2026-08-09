import { createId } from "@paralleldrive/cuid2";
import { and, eq, max } from "drizzle-orm";
import db from "../../../apps/fidelidade-api/src/database";
import {
  cardTable,
  customerTable,
  programTable,
  rewardTable,
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
  options: { storeName?: string; plan?: PlanId } = {},
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
  const [cycleRow] = await db
    .select({ value: max(cardTable.cycle) })
    .from(cardTable)
    .where(
      and(
        eq(cardTable.programId, programId),
        eq(cardTable.customerId, customerId),
      ),
    );

  const [card] = await db
    .insert(cardTable)
    .values({
      storeId,
      programId,
      customerId,
      cycle: Number(cycleRow?.value ?? 0) + 1,
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
 * Two completely independent stores, for asserting that neither can see the
 * other's data.
 */
export async function seedTwoIsolatedStores() {
  const a = await createStoreOwner({ storeName: "Padaria A" });
  const b = await createStoreOwner({ storeName: "Padaria B" });

  return { a, b };
}
