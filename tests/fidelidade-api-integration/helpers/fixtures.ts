import { createId } from "@paralleldrive/cuid2";
import db from "../../../apps/fidelidade-api/src/database";
import {
  storeMemberTable,
  storeTable,
  subscriptionTable,
  userTable,
} from "../../../apps/fidelidade-api/src/database/schema";
import type { PlanId } from "../../../apps/fidelidade-api/src/plans/limits";

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

/**
 * Two completely independent stores, for asserting that neither can see the
 * other's data.
 */
export async function seedTwoIsolatedStores() {
  const a = await createStoreOwner({ storeName: "Padaria A" });
  const b = await createStoreOwner({ storeName: "Padaria B" });

  return { a, b };
}
