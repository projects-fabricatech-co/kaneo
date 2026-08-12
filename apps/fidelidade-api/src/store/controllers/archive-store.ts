import { eq } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import db from "../../database";
import { storeTable } from "../../database/schema";

/**
 * Soft delete. Customers, cards and stamps are history a shop owner may still
 * need, so the store is archived rather than dropped.
 */
async function archiveStore(storeId: string) {
  const [archived] = await db
    .update(storeTable)
    .set({ archivedAt: new Date() })
    .where(eq(storeTable.id, storeId))
    .returning();

  if (!archived) {
    throw new HTTPException(404, { message: "Loja não encontrada" });
  }

  return archived;
}

export default archiveStore;
