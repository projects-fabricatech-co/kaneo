import { and, count, eq, isNull } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import db from "../../database";
import { storeMemberTable, storeTable } from "../../database/schema";
import { assertWithinLimit } from "../../plans/assert-within-limit";
import { resolvePlanForUser } from "../../plans/resolve-plan";
import { normalizeBrPhone } from "../../utils/phone";

export type CreateStoreInput = {
  name: string;
  slug: string;
  whatsapp?: string | null;
  city?: string | null;
  state?: string | null;
  timezone?: string;
  brandColor?: string;
  logoUrl?: string | null;
};

async function createStore(ownerUserId: string, input: CreateStoreInput) {
  const whatsapp = input.whatsapp?.trim()
    ? normalizeBrPhone(input.whatsapp)
    : null;

  const { plan, limits } = await resolvePlanForUser(ownerUserId);

  return db.transaction(async (tx) => {
    await assertWithinLimit(tx, {
      lockKey: `limit:stores:${ownerUserId}`,
      limit: limits.maxStores,
      code: "maxStores",
      plan,
      current: async () => {
        const [row] = await tx
          .select({ value: count() })
          .from(storeTable)
          .where(
            and(
              eq(storeTable.ownerUserId, ownerUserId),
              isNull(storeTable.archivedAt),
            ),
          );

        return Number(row?.value ?? 0);
      },
    });

    const [created] = await tx
      .insert(storeTable)
      .values({
        ownerUserId,
        name: input.name,
        slug: input.slug,
        whatsapp,
        city: input.city ?? null,
        state: input.state ? input.state.toUpperCase() : null,
        logoUrl: input.logoUrl ?? null,
        ...(input.timezone ? { timezone: input.timezone } : {}),
        ...(input.brandColor ? { brandColor: input.brandColor } : {}),
      })
      .onConflictDoNothing({ target: [storeTable.slug] })
      .returning();

    if (!created) {
      throw new HTTPException(409, {
        message: "Este endereço (slug) já está em uso",
      });
    }

    // The owner is a store_members row like anyone else, so every access check
    // is a single membership lookup with no special case for the owner.
    await tx.insert(storeMemberTable).values({
      storeId: created.id,
      userId: ownerUserId,
      role: "owner",
    });

    return created;
  });
}

export default createStore;
