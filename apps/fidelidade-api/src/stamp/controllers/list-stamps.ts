import { and, desc, eq } from "drizzle-orm";
import db from "../../database";
import { stampTable } from "../../database/schema";

export const DEFAULT_STAMP_HISTORY_SIZE = 50;

export type ListStampsOptions = {
  cardId?: string;
  customerId?: string;
  limit?: number;
};

/**
 * Voided stamps are INCLUDED: this is the audit view an owner uses to see what a
 * cashier did, and hiding cancellations would defeat the point.
 */
async function listStamps(
  storeId: string,
  { cardId, customerId, limit }: ListStampsOptions = {},
) {
  const filters = [eq(stampTable.storeId, storeId)];

  if (cardId) {
    filters.push(eq(stampTable.cardId, cardId));
  }

  if (customerId) {
    filters.push(eq(stampTable.customerId, customerId));
  }

  return db
    .select()
    .from(stampTable)
    .where(and(...filters))
    .orderBy(desc(stampTable.createdAt))
    .limit(limit ?? DEFAULT_STAMP_HISTORY_SIZE);
}

export default listStamps;
