import { and, eq } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import db, { schema } from "../database";

export type StoreMember = typeof schema.storeMemberTable.$inferSelect;

/**
 * Deliberately 404, never 403: a 403 confirms that a store with that id exists,
 * which turns the endpoint into a cross-tenant enumeration oracle. From the
 * caller's point of view a store they are not a member of simply does not
 * exist.
 */
export async function validateStoreAccess(
  userId: string,
  storeId: string,
): Promise<StoreMember> {
  const [member] = await db
    .select()
    .from(schema.storeMemberTable)
    .where(
      and(
        eq(schema.storeMemberTable.storeId, storeId),
        eq(schema.storeMemberTable.userId, userId),
      ),
    )
    .limit(1);

  if (!member) {
    throw new HTTPException(404, { message: "Loja não encontrada" });
  }

  return member;
}
