import { and, desc, eq } from "drizzle-orm";
import db from "../../database";
import { cardTable } from "../../database/schema";

export type ListCardsOptions = {
  customerId?: string;
  programId?: string;
};

async function listCards(
  storeId: string,
  { customerId, programId }: ListCardsOptions = {},
) {
  const filters = [eq(cardTable.storeId, storeId)];

  if (customerId) {
    filters.push(eq(cardTable.customerId, customerId));
  }

  if (programId) {
    filters.push(eq(cardTable.programId, programId));
  }

  return db
    .select()
    .from(cardTable)
    .where(and(...filters))
    .orderBy(desc(cardTable.createdAt));
}

export default listCards;
