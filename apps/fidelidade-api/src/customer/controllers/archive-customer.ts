import { and, eq } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import db from "../../database";
import { customerTable } from "../../database/schema";

/**
 * Soft delete: the cards and stamps are the shop's own history. Archiving also
 * frees a slot against `maxCustomersPerStore`, which counts only rows with
 * `archived_at IS NULL`.
 */
async function archiveCustomer(storeId: string, customerId: string) {
  const [archived] = await db
    .update(customerTable)
    .set({ archivedAt: new Date() })
    .where(
      and(eq(customerTable.id, customerId), eq(customerTable.storeId, storeId)),
    )
    .returning();

  if (!archived) {
    throw new HTTPException(404, { message: "Cliente não encontrado" });
  }

  return archived;
}

export default archiveCustomer;
